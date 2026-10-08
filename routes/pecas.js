const express = require('express');
const db = require('../database');
const { hoje, dataValida, validarId, camposFaltando } = require('../utils');

const router = express.Router();

// Confere se a ordem de serviço existe e se ainda pode receber alterações.
// Devolve uma mensagem de erro, ou null se estiver tudo certo.
function verificarOrdem(ordemId) {
  const ordem = db.prepare('SELECT * FROM ordens_servico WHERE id = ?').get(ordemId);
  if (!ordem) {
    return { status: 404, erro: 'Ordem de serviço não encontrada' };
  }
  if (ordem.status === 'Finalizada') {
    return { status: 400, erro: 'Ordem de serviço já finalizada. Não é possível alterar suas peças.' };
  }
  return null;
}

// Confere se quantidade e custo são números válidos
function verificarValores(quantidade, custoUnitario) {
  if (!Number.isInteger(Number(quantidade)) || Number(quantidade) <= 0) {
    return 'quantidade deve ser um número inteiro maior que zero';
  }
  if (isNaN(Number(custoUnitario)) || Number(custoUnitario) < 0) {
    return 'custo_unitario deve ser um número maior ou igual a zero';
  }
  return null;
}

// Listar todas as peças substituídas
router.get('/', (req, res) => {
  const pecas = db.prepare('SELECT * FROM pecas').all();
  res.json(pecas);
});

// Problema 4: histórico de substituições de uma peça (pelo código)
// Pode filtrar pelo ano: /api/pecas/historico/ROL-6205?ano=2026
router.get('/historico/:codigo', (req, res) => {
  const ano = req.query.ano || '';

  const historico = db.prepare(`
    SELECT pecas.id, pecas.nome, pecas.codigo, pecas.quantidade, pecas.custo_unitario, pecas.data_substituicao,
           pecas.ordem_servico_id, equipamentos.nome AS equipamento
    FROM pecas
    JOIN ordens_servico ON ordens_servico.id = pecas.ordem_servico_id
    JOIN equipamentos ON equipamentos.id = ordens_servico.equipamento_id
    WHERE pecas.codigo = ? AND pecas.data_substituicao LIKE ?
    ORDER BY pecas.data_substituicao
  `).all(req.params.codigo, ano + '%');

  if (historico.length === 0) {
    return res.status(404).json({ erro: 'Nenhuma substituição encontrada para essa peça' });
  }

  const totalQuantidade = historico.reduce((soma, peca) => soma + peca.quantidade, 0);

  res.json({
    codigo: req.params.codigo,
    vezes_substituida: historico.length,
    quantidade_total: totalQuantidade,
    historico
  });
});

// Buscar peça por ID
router.get('/:id', validarId, (req, res) => {
  const peca = db.prepare('SELECT * FROM pecas WHERE id = ?').get(req.params.id);
  if (!peca) {
    return res.status(404).json({ erro: 'Peça não encontrada' });
  }

  res.json(peca);
});

// Registrar peça substituída
router.post('/', (req, res) => {
  const faltando = camposFaltando(req.body, ['ordem_servico_id', 'nome', 'codigo', 'quantidade', 'custo_unitario']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  const { ordem_servico_id, nome, codigo, quantidade, custo_unitario } = req.body;

  const erroValores = verificarValores(quantidade, custo_unitario);
  if (erroValores) {
    return res.status(400).json({ erro: erroValores });
  }

  const problemaOrdem = verificarOrdem(ordem_servico_id);
  if (problemaOrdem) {
    return res.status(problemaOrdem.status).json({ erro: problemaOrdem.erro });
  }

  const dataSubstituicao = req.body.data_substituicao || hoje();
  if (!dataValida(dataSubstituicao)) {
    return res.status(400).json({ erro: 'data_substituicao deve ser uma data no formato AAAA-MM-DD' });
  }

  const resultado = db.prepare(`
    INSERT INTO pecas (ordem_servico_id, nome, codigo, quantidade, custo_unitario, data_substituicao)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(ordem_servico_id, nome, codigo, Number(quantidade), Number(custo_unitario), dataSubstituicao);

  res.status(201).json(db.prepare('SELECT * FROM pecas WHERE id = ?').get(resultado.lastInsertRowid));
});

// Atualizar peça
router.put('/:id', validarId, (req, res) => {
  const peca = db.prepare('SELECT * FROM pecas WHERE id = ?').get(req.params.id);
  if (!peca) {
    return res.status(404).json({ erro: 'Peça não encontrada' });
  }

  // Junta os dados atuais com os enviados (só muda o que veio no body)
  const dados = { ...peca, ...req.body };

  const faltando = camposFaltando(dados, ['ordem_servico_id', 'nome', 'codigo', 'quantidade', 'custo_unitario']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  const erroValores = verificarValores(dados.quantidade, dados.custo_unitario);
  if (erroValores) {
    return res.status(400).json({ erro: erroValores });
  }

  const problemaOrdem = verificarOrdem(peca.ordem_servico_id) || verificarOrdem(dados.ordem_servico_id);
  if (problemaOrdem) {
    return res.status(problemaOrdem.status).json({ erro: problemaOrdem.erro });
  }

  if (!dataValida(dados.data_substituicao)) {
    return res.status(400).json({ erro: 'data_substituicao deve ser uma data no formato AAAA-MM-DD' });
  }

  db.prepare(`
    UPDATE pecas
    SET ordem_servico_id = ?, nome = ?, codigo = ?, quantidade = ?, custo_unitario = ?, data_substituicao = ?
    WHERE id = ?
  `).run(dados.ordem_servico_id, dados.nome, dados.codigo, Number(dados.quantidade), Number(dados.custo_unitario), dados.data_substituicao, peca.id);

  res.json(db.prepare('SELECT * FROM pecas WHERE id = ?').get(peca.id));
});

// Excluir peça
router.delete('/:id', validarId, (req, res) => {
  const peca = db.prepare('SELECT * FROM pecas WHERE id = ?').get(req.params.id);
  if (!peca) {
    return res.status(404).json({ erro: 'Peça não encontrada' });
  }

  const problemaOrdem = verificarOrdem(peca.ordem_servico_id);
  if (problemaOrdem) {
    return res.status(problemaOrdem.status).json({ erro: problemaOrdem.erro });
  }

  db.prepare('DELETE FROM pecas WHERE id = ?').run(peca.id);
  res.json({ mensagem: 'Peça excluída com sucesso' });
});

module.exports = router;
