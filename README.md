# MiniHost

MiniHost é um painel web simples para organizar domínios, subdomínios e registros DNS da sua VPS.

O objetivo futuro do projeto é evoluir para uma plataforma de gestão e automação usando PostgreSQL, Cloudflare, Coolify e deploys em VPS.

## Etapa 2 implementada

- Layout principal com sidebar, header e navegação entre telas.
- Prisma ORM configurado com PostgreSQL.
- Models `Domain`, `DnsRecord`, `AppSetting` e `AuditLog`.
- Migration inicial em `prisma/migrations`.
- Seed inicial com `robertlindomar.dev` e 4 registros DNS.
- Dashboard com estatísticas vindas do PostgreSQL.
- CRUD de domínios persistido no banco.
- CRUD de registros DNS persistido no banco.
- Configurações salvas em `app_settings`.
- Histórico salvo em `audit_logs`.
- Validações simples para registros `A`, `CNAME`, `TXT` e `MX`.
- Confirmação antes de excluir domínios e registros.
- Aviso visual ao excluir registros sensíveis como `@`, `www`, `mail`, `MX` ou `TXT`.
- Tratamento de erro quando o banco está indisponível.
- Loading states simples nas telas e ações.

## Configurar ambiente

```bash
npm install
cp .env.example .env
```

Configure `DATABASE_URL` no `.env`:

```env
DATABASE_URL="postgresql://postgres:123@localhost:5432/minihost?schema=public"
```

Crie o banco se ele ainda não existir:

```bash
psql "postgresql://postgres:123@localhost:5432/postgres" -c "CREATE DATABASE minihost"
```

## Migrations e seed

```bash
npx prisma migrate dev
npm run db:seed
```

## Iniciar o projeto

```bash
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

Os testes E2E usam Playwright e cobrem navegação, CRUD de domínios, CRUD de registros DNS, histórico e persistência das configurações no PostgreSQL.

## Próximas etapas sugeridas

1. Adicionar autenticação/admin.
2. Integrar Cloudflare API.
3. Criar registros DNS reais.
4. Integrar com Coolify futuramente.

## Observação

Ainda não há integração real com Cloudflare, Coolify ou autenticação.
