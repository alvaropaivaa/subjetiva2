const express = require('express');
const db = require('../database');
const { hoje, somarDias, dataValida, validarId, camposFaltando } = require('../utils');

const router = express.Router();

const TIPOS_VALIDOS = ['Preventiva', 'Corretiva'];
const STATUS_VALIDOS = ['Aberta', 'Em andamento', 'Finalizada'];

// Consulta da ordem de serviço já com o nome do equipamento
const SELECT_ORDEM = `
  SELECT ordens_servico.*, equipamentos.nome AS equipamento
  FROM ordens_servico
  JOIN equipamentos ON equipamentos.id = ordens_servico.equipamento_id
`;

// Se o equipamento não tiver mais ordens abertas, ele sai de "Em manutenção" e volta para "Ativo"
function liberarEquipamento(equipamentoId) {
  const abertas = db
    .prepare("SELECT COUNT(*) AS total FROM ordens_servico WHERE equipamento_id = ? AND status != 'Finalizada'")
    .get(equipamentoId);

  if (abertas.total === 0) {
    db.prepare("UPDATE equipamentos SET status = 'Ativo' WHERE id = ? AND status = 'Em manutenção'").run(equipamentoId);
  }
}

// Listar todas as ordens de serviço
router.get('/', (req, res) => {
  const ordens = db.prepare(SELECT_ORDEM).all();
  res.json(ordens);
});

// Buscar ordem de serviço por ID
router.get('/:id', validarId, (req, res) => {
  const ordem = db.prepare(SELECT_ORDEM + ' WHERE ordens_servico.id = ?').get(req.params.id);
  if (!ordem) {
    return res.status(404).json({ erro: 'Ordem de serviço não encontrada' });
  }

  res.json(ordem);
});

// Problema 8: custo total das peças usadas na ordem de serviço
router.get('/:id/custo-total', validarId, (req, res) => {
  const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(req.params.id);
  if (!ordem) {
    return res.status(404).json({ erro: 'Ordem de serviço não encontrada' });
  }

  const pecas = db.prepare(`
    SELECT nome, codigo, quantidade, custo_unitario, ROUND(quantidade * custo_unitario, 2) AS subtotal
    FROM pecas
    WHERE ordem_servico_id = ?
  `).all(ordem.id);

  const total = db.prepare(`
    SELECT ROUND(SUM(quantidade * custo_unitario), 2) AS custo_total
    FROM pecas
    WHERE ordem_servico_id = ?
  `).get(ordem.id);

  res.json({ ordem_servico_id: ordem.id, pecas, custo_total: total.custo_total || 0 });
});

// Abrir ordem de serviço
router.post('/', (req, res) => {
  const faltando = camposFaltando(req.body, ['equipamento_id', 'tipo', 'responsavel']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  const { equipamento_id, tipo, responsavel } = req.body;

  if (!TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ erro: 'Tipo de manutenção inválido', valores_aceitos: TIPOS_VALIDOS });
  }

  // Problema 2: não deixa abrir ordem de serviço para equipamento que não existe
  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(equipamento_id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado. Não é possível abrir a ordem de serviço.' });
  }

  const dataAbertura = req.body.data_abertura || hoje();
  if (!dataValida(dataAbertura)) {
    return res.status(400).json({ erro: 'data_abertura deve ser uma data no formato AAAA-MM-DD' });
  }

  const resultado = db
    .prepare("INSERT INTO ordens_servico (equipamento_id, tipo, data_abertura, responsavel, status) VALUES (?, ?, ?, ?, 'Aberta')")
    .run(equipamento_id, tipo, dataAbertura, responsavel);

  // Com a ordem aberta, o equipamento passa a ficar "Em manutenção"
  db.prepare("UPDATE equipamentos SET status = 'Em manutenção' WHERE id = ?").run(equipamento_id);

  const ordem = db.prepare(SELECT_ORDEM + ' WHERE ordens_servico.id = ?').get(resultado.lastInsertRowid);
  res.status(201).json(ordem);
});

// Atualizar ordem de serviço (também é usado para finalizar)
router.put('/:id', validarId, (req, res) => {
  const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(req.params.id);
  if (!ordem) {
    return res.status(404).json({ erro: 'Ordem de serviço não encontrada' });
  }

  if (ordem.status === 'Finalizada') {
    return res.status(400).json({ erro: 'Ordem de serviço já finalizada. Não pode ser alterada.' });
  }

  // Junta os dados atuais com os enviados (só muda o que veio no body)
  const dados = { ...ordem, ...req.body };

  const faltando = camposFaltando(dados, ['equipamento_id', 'tipo', 'responsavel']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  if (!TIPOS_VALIDOS.includes(dados.tipo)) {
    return res.status(400).json({ erro: 'Tipo de manutenção inválido', valores_aceitos: TIPOS_VALIDOS });
  }

  if (!STATUS_VALIDOS.includes(dados.status)) {
    return res.status(400).json({ erro: 'Status inválido', valores_aceitos: STATUS_VALIDOS });
  }

  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(dados.equipamento_id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado' });
  }

  // Ao finalizar, a data de conclusão é hoje (se não for informada)
  if (dados.status === 'Finalizada' && !dados.data_conclusao) {
    dados.data_conclusao = hoje();
  }

  if (dados.data_conclusao && !dataValida(dados.data_conclusao)) {
    return res.status(400).json({ erro: 'data_conclusao deve ser uma data no formato AAAA-MM-DD' });
  }

  db.prepare(`
    UPDATE ordens_servico
    SET equipamento_id = ?, tipo = ?, data_abertura = ?, data_conclusao = ?, responsavel = ?, status = ?
    WHERE id = ?
  `).run(dados.equipamento_id, dados.tipo, dados.data_abertura, dados.data_conclusao, dados.responsavel, dados.status, ordem.id);

  if (dados.status === 'Finalizada') {
    liberarEquipamento(equipamento.id);

    // Se for preventiva, atualiza a última e a próxima manutenção do equipamento
    if (dados.tipo === 'Preventiva' && equipamento.periodicidade_dias) {
      const proxima = somarDias(dados.data_conclusao, equipamento.periodicidade_dias);
      db.prepare('UPDATE equipamentos SET ultima_manutencao = ?, proxima_manutencao = ? WHERE id = ?')
        .run(dados.data_conclusao, proxima, equipamento.id);
    }
  }

  res.json(db.prepare(SELECT_ORDEM + ' WHERE ordens_servico.id = ?').get(ordem.id));
});

// Excluir ordem de serviço (as peças dela também são excluídas)
router.delete('/:id', validarId, (req, res) => {
  const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(req.params.id);
  if (!ordem) {
    return res.status(404).json({ erro: 'Ordem de serviço não encontrada' });
  }

  if (ordem.status === 'Finalizada') {
    return res.status(400).json({ erro: 'Ordem de serviço já finalizada. Não pode ser excluída.' });
  }

  db.prepare('DELETE FROM pecas WHERE ordem_servico_id = ?').run(ordem.id);
  db.prepare('DELETE FROM ordens_servico WHERE id = ?').run(ordem.id);
  liberarEquipamento(ordem.equipamento_id);

  res.json({ mensagem: 'Ordem de serviço excluída com sucesso' });
});

module.exports = router;
