# MiniHost

MiniHost é um painel web simples para organizar domínios, subdomínios e registros DNS da sua VPS.

O objetivo futuro do projeto é evoluir para uma plataforma local de gestão e automação usando PostgreSQL, Cloudflare, Coolify e deploys em VPS. Nesta etapa inicial, o foco é entregar uma base visual bonita, organizada e fácil de evoluir.

## Etapa 1 implementada

- Layout principal com sidebar, header e navegação entre telas.
- Dashboard com estatísticas de domínios, registros DNS, proxy ativo e última alteração.
- CRUD local de domínios usando `localStorage`.
- CRUD local de registros DNS usando `localStorage`.
- Validações simples para registros `A`, `CNAME`, `TXT` e `MX`.
- Confirmação antes de excluir domínios e registros.
- Aviso visual ao excluir registros sensíveis como `@`, `www`, `mail`, `MX` ou `TXT`.
- Histórico local para criações, edições e exclusões.
- Tela de configurações visuais persistida em `localStorage`.
- Dados iniciais mockados com o domínio `robertlindomar.dev`.

## Como rodar

```bash
npm install
npm run dev
```

Depois acesse:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

## Testes de navegador

```bash
npm run test:e2e
```

Os testes E2E usam Playwright e cobrem navegação, CRUD local de domínios, CRUD local de registros DNS, histórico e persistência das configurações.

## Próximas etapas sugeridas

1. Conectar com banco PostgreSQL.
2. Adicionar autenticação.
3. Integrar Cloudflare API.
4. Criar registros DNS reais.
5. Integrar com Coolify futuramente.

## Observação

A Etapa 1 é uma simulação local. Não há integração real com Cloudflare, Coolify, autenticação ou banco de dados.
