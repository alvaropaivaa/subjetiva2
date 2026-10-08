const express = require('express');

const equipamentos = require('./routes/equipamentos');
const preventivas = require('./routes/preventivas');
const ordensServico = require('./routes/ordensServico');
const defeitos = require('./routes/defeitos');
const pecas = require('./routes/pecas');

const app = express();
app.use(express.json());

// Rotas da API
app.use('/api/equipamentos', equipamentos);
app.use('/api/preventivas', preventivas);
app.use('/api/ordens-servico', ordensServico);
app.use('/api/defeitos', defeitos);
app.use('/api/pecas', pecas);

// Rota que não existe
app.use((req, res) => {
  res.status(404).json({ erro: 'Rota não encontrada' });
});

// Tratamento de erros gerais (ex.: JSON mal escrito no body)
app.use((erro, req, res, next) => {
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no body da requisição' });
  }

  console.error(erro);
  res.status(500).json({ erro: 'Erro interno no servidor' });
});

app.listen(3000, () => {
  console.log('API de Manutenção Industrial rodando em http://localhost:3000');
});
