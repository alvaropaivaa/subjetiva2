// Data de hoje no formato AAAA-MM-DD
function hoje() {
  return new Date().toISOString().slice(0, 10);
}

// Soma dias em uma data (AAAA-MM-DD)
function somarDias(data, dias) {
  const d = new Date(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Confere se o texto é uma data válida no formato AAAA-MM-DD
function dataValida(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !isNaN(new Date(texto));
}

// Middleware: confere se o :id da URL é um número inteiro positivo
function validarId(req, res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erro: 'ID inválido. O ID deve ser um número inteiro positivo.' });
  }
  next();
}

// Retorna a lista de campos obrigatórios que não foram enviados
function camposFaltando(dados, campos) {
  return campos.filter((campo) => dados[campo] === undefined || dados[campo] === null || dados[campo] === '');
}

module.exports = { hoje, somarDias, dataValida, validarId, camposFaltando };
