const express = require('express');
const db = require('../database');
const { hoje, somarDias, dataValida, validarId, camposFaltando } = require('../utils');

const router = express.Router();

// Listar o controle de manutenção preventiva de todos os equipamentos
router.get('/', (req, res) => {
  const equipamentos = db.prepare(`
    SELECT id, nome, periodicidade_dias, ultima_manutencao, proxima_manutencao
    FROM equipamentos
    WHERE periodicidade_dias IS NOT NULL
  `).all();

  const lista = equipamentos.map((equipamento) => ({
    ...equipamento,
    situacao: equipamento.proxima_manutencao < hoje() ? 'VENCIDA' : 'Em dia'
  }));

  res.json(lista);
});

// Problema 3: alerta das manutenções preventivas vencidas
router.get('/vencidas', (req, res) => {
  const vencidas = db.prepare(`
    SELECT id, nome, periodicidade_dias, ultima_manutencao, proxima_manutencao
    FROM equipamentos
    WHERE proxima_manutencao < ?
  `).all(hoje());

  const lista = vencidas.map((equipamento) => ({
    ...equipamento,
    alerta: `ATENÇÃO: manutenção preventiva vencida desde ${equipamento.proxima_manutencao}`
  }));

  res.json({ total_vencidas: lista.length, equipamentos: lista });
});

// Registrar a periodicidade e a última manutenção (o :id é do equipamento)
// A próxima manutenção é calculada: última manutenção + periodicidade
router.put('/:id', validarId, (req, res) => {
  const equipamento = db.prepare('SELECT * FROM equipamentos WHERE id = ?').get(req.params.id);
  if (!equipamento) {
    return res.status(404).json({ erro: 'Equipamento não encontrado' });
  }

  const faltando = camposFaltando(req.body, ['periodicidade_dias', 'ultima_manutencao']);
  if (faltando.length > 0) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes', campos: faltando });
  }

  const periodicidade = Number(req.body.periodicidade_dias);
  if (!Number.isInteger(periodicidade) || periodicidade <= 0) {
    return res.status(400).json({ erro: 'periodicidade_dias deve ser um número inteiro maior que zero' });
  }

  const ultima = req.body.ultima_manutencao;
  if (!dataValida(ultima)) {
    return res.status(400).json({ erro: 'ultima_manutencao deve ser uma data no formato AAAA-MM-DD' });
  }

  const proxima = somarDias(ultima, periodicidade);

  db.prepare('UPDATE equipamentos SET periodicidade_dias = ?, ultima_manutencao = ?, proxima_manutencao = ? WHERE id = ?')
    .run(periodicidade, ultima, proxima, equipamento.id);

  res.json({
    equipamento_id: equipamento.id,
    nome: equipamento.nome,
    periodicidade_dias: periodicidade,
    ultima_manutencao: ultima,
    proxima_manutencao: proxima,
    situacao: proxima < hoje() ? 'VENCIDA' : 'Em dia'
  });
});

module.exports = router;
