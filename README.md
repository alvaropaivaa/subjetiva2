# API de Controle de Manutenção Industrial (NP1)

API REST em Node.js + Express + SQLite para gerenciar equipamentos, ordens de serviço, defeitos, peças substituídas e manutenção preventiva.

Precisa do **Node.js 22.13 ou mais novo** (o SQLite usado já vem dentro do Node).

## Como rodar

```
npm install
npm start
```

A API fica em `http://localhost:3000`. O banco (`manutencao.db`) é criado sozinho.

Para começar do zero, pare o servidor (Ctrl+C) e rode `npm run zerar`.

Se o PowerShell bloquear o `npm`, rode antes:

```
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Documentação e testes

- `docs/Documentacao-API.pdf`: todos os endpoints com URL, método, body e resposta esperada, além dos 8 problemas resolvidos.
- `docs/Colecao-Postman.json`: coleção do Postman com 51 requisições. No Postman: **Import** → escolha o arquivo → abra a coleção → **Run**. Rode com o banco vazio para os IDs baterem.

## Rotas

| Recurso | Rotas |
|---|---|
| Equipamentos | `GET/POST /api/equipamentos`, `GET/PUT/DELETE /api/equipamentos/:id`, `GET /api/equipamentos/em-manutencao` |
| Preventiva | `GET /api/preventivas`, `GET /api/preventivas/vencidas`, `PUT /api/preventivas/:id` |
| Ordens de serviço | `GET/POST /api/ordens-servico`, `GET/PUT/DELETE /api/ordens-servico/:id`, `GET /api/ordens-servico/:id/custo-total` |
| Defeitos | `GET/POST /api/defeitos`, `GET/PUT/DELETE /api/defeitos/:id` |
| Peças | `GET/POST /api/pecas`, `GET/PUT/DELETE /api/pecas/:id`, `GET /api/pecas/historico/:codigo` |
