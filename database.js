const path = require('path');
const { DatabaseSync } = require('node:sqlite'); // SQLite que já vem no Node.js (não precisa instalar)

// Cria (ou abre) o arquivo do banco de dados na pasta do projeto
const db = new DatabaseSync(path.join(__dirname, 'manutencao.db'));

// Faz o banco respeitar as ligações entre as tabelas (chaves estrangeiras)
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS equipamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    modelo TEXT NOT NULL,
    fabricante TEXT NOT NULL,
    data_instalacao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Ativo',
    periodicidade_dias INTEGER,
    ultima_manutencao TEXT,
    proxima_manutencao TEXT
  );

  CREATE TABLE IF NOT EXISTS ordens_servico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento_id INTEGER NOT NULL REFERENCES equipamentos(id),
    tipo TEXT NOT NULL,
    data_abertura TEXT NOT NULL,
    data_conclusao TEXT,
    responsavel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Aberta'
  );

  CREATE TABLE IF NOT EXISTS defeitos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    equipamento_id INTEGER NOT NULL REFERENCES equipamentos(id),
    descricao TEXT NOT NULL,
    severidade TEXT NOT NULL,
    data_registro TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pecas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ordem_servico_id INTEGER NOT NULL REFERENCES ordens_servico(id),
    nome TEXT NOT NULL,
    codigo TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    custo_unitario REAL NOT NULL,
    data_substituicao TEXT NOT NULL
  );
`);

module.exports = db;
