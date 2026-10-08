const express = require('express');
const db = require('../database');
const { dataValida, validarId, camposFaltando } = require('../utils');

const router = express.Router();

const STATUS_VALIDOS = ['Ativo', 'Em manutenção', 'Inativo'];

// Listar todos os equipamentos
router.get('/', (req, res) => {
  const equipamentos = db.prepare('SELECT * FROM equipamentos').all();
  res.json(equipamentos);
});

// Problema 7: listar equipamentos que estão em manutenção
router.get('/em-manutencao', (req, res) => {
  const equipamentos = db.prepare("SELECT * FROM equipamentos WHERE status = 'Em manutenção'").all();
  res.json(equipamentos);
});

// Buscar equipamento por ID
router.get('/:id', validarId, (req, res) => {
  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(req.params.id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado' });
  }

  res.json(equipamento);
});

// Cadastrar equipamento
router.post('/', (req, res) => {
  const faltando = camposFaltando(req.body, ['nome', 'modelo', 'fabricante', 'data_instalacao']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  const { nome, modelo, fabricante, data_instalacao } = req.body;
  const status = req.body.status || 'Ativo';

  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido', valores_aceitos: STATUS_VALIDOS });
  }

  if (!dataValida(data_instalacao)) {
    return res.status(400).json({ erro: 'data_instalacao deve ser uma data no formato AAAA-MM-DD' });
  }

  const resultado = db
    .prepare('INSERT INTO equipamentos (nome, modelo, fabricante, data_instalacao, status) VALUES (?, ?, ?, ?, ?)')
    .run(nome, modelo, fabricante, data_instalacao, status);

  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(resultado.lastInsertRowid);
  res.status(201).json(equipamento);
});

// Problema 1: atualizar um equipamento cadastrado errado
router.put('/:id', validarId, (req, res) => {
  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(req.params.id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado' });
  }

  // Junta os dados atuais com os enviados (só muda o que veio no body)
  const dados = { ...equipamento, ...req.body };

  const faltando = camposFaltando(dados, ['nome', 'modelo', 'fabricante', 'data_instalacao']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  if (!STATUS_VALIDOS.includes(dados.status)) {
    return res.status(400).json({ erro: 'Status inválido', valores_aceitos: STATUS_VALIDOS });
  }

  if (!dataValida(dados.data_instalacao)) {
    return res.status(400).json({ erro: 'data_instalacao deve ser uma data no formato AAAA-MM-DD' });
  }

  db.prepare('UPDATE equipamentos SET nome = ?, modelo = ?, fabricante = ?, data_instalacao = ?, status = ? WHERE id = ?')
    .run(dados.nome, dados.modelo, dados.fabricante, dados.data_instalacao, dados.status, equipamento.id);

  res.json(db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(equipamento.id));
});

// Problema 6: não deixa excluir equipamento que tem ordens de serviço ou defeitos ligados a ele
router.delete('/:id', validarId, (req, res) => {
  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(req.params.id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado' });
  }

  const ordens = db.prepare('SELECT COUNT(*) AS total FROM ordens_servico WHERE equipamento_id = ?').get(equipamento.id);
  if (ordens.total > 0) {
    return res.status(409).json({
      erro: `Não é possível excluir: o equipamento possui ${ordens.total} ordem(ns) de serviço vinculada(s). Altere o status para Inativo.`
    });
  }

  const defeitos = db.prepare('SELECT COUNT(*) AS total FROM defeitos WHERE equipamento_id = ?').get(equipamento.id);
  if (defeitos.total > 0) {
    return res.status(409).json({
      erro: `Não é possível excluir: o equipamento possui ${defeitos.total} defeito(s) registrado(s). Altere o status para Inativo.`
    });
  }

  db.prepare('DELETE FROM equipamentos WHERE id = ?').run(equipamento.id);
  res.json({ mensagem: 'Equipamento excluído com sucesso' });
});

module.exports = router;
