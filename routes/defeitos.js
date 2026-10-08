const express = require('express');
const db = require('../database');
const { hoje, dataValida, validarId, camposFaltando } = require('../utils');

const router = express.Router();

const SEVERIDADES = ['Baixo', 'Médio', 'Alto', 'Crítico'];

// Consulta do defeito já com o nome do equipamento
const SELECT_DEFEITO = `
  SELECT defeitos.*, equipamentos.nome AS equipamento
  FROM defeitos
  JOIN equipamentos ON equipamentos.id = defeitos.equipamento_id
`;

// Problema 5: defeito crítico ganha prioridade URGENTE e um alerta
function destacar(defeito) {
  if (defeito.severidade === 'Crítico') {
    return { ...defeito, prioridade: 'URGENTE', alerta: 'DEFEITO CRÍTICO: atendimento imediato!' };
  }
  return { ...defeito, prioridade: 'Normal' };
}

// Listar defeitos: os mais graves aparecem primeiro (Crítico, Alto, Médio, Baixo)
router.get('/', (req, res) => {
  const defeitos = db.prepare(SELECT_DEFEITO + `
    ORDER BY CASE severidade
      WHEN 'Crítico' THEN 1
      WHEN 'Alto' THEN 2
      WHEN 'Médio' THEN 3
      ELSE 4
    END
  `).all();

  res.json(defeitos.map(destacar));
});

// Buscar defeito por ID
router.get('/:id', validarId, (req, res) => {
  const defeito = db.prepare(SELECT_DEFEITO + ' WHERE defeitos.id = ?').get(req.params.id);
  if (!defeito) {
    return res.status(404).json({ erro: 'Defeito não encontrado' });
  }

  res.json(destacar(defeito));
});

// Registrar defeito
router.post('/', (req, res) => {
  const faltando = camposFaltando(req.body, ['equipamento_id', 'descricao', 'severidade']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  const { equipamento_id, descricao, severidade } = req.body;

  if (!SEVERIDADES.includes(severidade)) {
    return res.status(400).json({ erro: 'Severidade inválida', valores_aceitos: SEVERIDADES });
  }

  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(equipamento_id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado' });
  }

  const dataRegistro = req.body.data_registro || hoje();
  if (!dataValida(dataRegistro)) {
    return res.status(400).json({ erro: 'data_registro deve ser uma data no formato AAAA-MM-DD' });
  }

  const resultado = db
    .prepare('INSERT INTO defeitos (equipamento_id, descricao, severidade, data_registro) VALUES (?, ?, ?, ?)')
    .run(equipamento_id, descricao, severidade, dataRegistro);

  const defeito = db.prepare(SELECT_DEFEITO + ' WHERE defeitos.id = ?').get(resultado.lastInsertRowid);
  res.status(201).json(destacar(defeito));
});

// Atualizar defeito
router.put('/:id', validarId, (req, res) => {
  const defeito = db.prepare('SELECT * FROM defeitos WHERE id = ?').get(req.params.id);
  if (!defeito) {
    return res.status(404).json({ erro: 'Defeito não encontrado' });
  }

  // Junta os dados atuais com os enviados (só muda o que veio no body)
  const dados = { ...defeito, ...req.body };

  const faltando = camposFaltando(dados, ['equipamento_id', 'descricao', 'severidade']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  if (!SEVERIDADES.includes(dados.severidade)) {
    return res.status(400).json({ erro: 'Severidade inválida', valores_aceitos: SEVERIDADES });
  }

  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(dados.equipamento_id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado' });
  }

  if (!dataValida(dados.data_registro)) {
    return res.status(400).json({ erro: 'data_registro deve ser uma data no formato AAAA-MM-DD' });
  }

  db.prepare('UPDATE defeitos SET equipamento_id = ?, descricao = ?, severidade = ?, data_registro = ? WHERE id = ?')
    .run(dados.equipamento_id, dados.descricao, dados.severidade, dados.data_registro, defeito.id);

  res.json(destacar(db.prepare(SELECT_DEFEITO + ' WHERE defeitos.id = ?').get(defeito.id)));
});

// Excluir defeito
router.delete('/:id', validarId, (req, res) => {
  const defeito = db.prepare('SELECT * FROM defeitos WHERE id = ?').get(req.params.id);
  if (!defeito) {
    return res.status(404).json({ erro: 'Defeito não encontrado' });
  }

  db.prepare('DELETE FROM defeitos WHERE id = ?').run(defeito.id);
  res.json({ mensagem: 'Defeito excluído com sucesso' });
});

module.exports = router;
