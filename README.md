# MiniHost

MiniHost é um painel web simples para organizar domínios, subdomínios e registros DNS da sua VPS.

O objetivo futuro do projeto é evoluir para uma plataforma de gestão e automação usando PostgreSQL, Cloudflare, Coolify e deploys em VPS.

## Etapa 5 implementada

- Layout principal com sidebar, header e navegação entre telas.
- Prisma ORM configurado com PostgreSQL.
- Models `User`, `Domain`, `DnsRecord`, `AppSetting` e `AuditLog`.
- Seed inicial com `robertlindomar.dev` e 4 registros DNS.
- Usuário admin inicial com senha hasheada.
- Login administrativo em `/login`.
- Sessão com cookie `httpOnly` e rotas protegidas.
- Dashboard com estatísticas vindas do PostgreSQL.
- CRUD de domínios persistido no banco.
- CRUD de registros DNS persistido no banco.
- Configurações salvas em `app_settings`.
- Histórico salvo em `audit_logs`.
- Auditoria associada ao usuário logado quando possível.
- Integração Cloudflare API no backend.
- Sincronização de registros reais da Cloudflare para o PostgreSQL.
- Criação de registros DNS reais na Cloudflare pelo MiniHost.
- Opção de criar registros apenas localmente ou criar também na Cloudflare.
- Identificação visual da origem do registro: Manual ou Cloudflare.
- Validações para registros `A`, `AAAA`, `CNAME`, `TXT` e `MX`.
- Bloqueio de duplicidade e conflito entre `CNAME` e `A/AAAA`.
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
AUTH_SECRET="troque-este-segredo-em-producao"
CLOUDFLARE_API_TOKEN=""
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

O seed cria o admin inicial:

```text
Email: admin@minihost.local
Senha: admin123
```

## Iniciar o projeto

```bash
npm run dev
```

Depois acesse:

```text
http://localhost:3000/login
```

Entre com o admin inicial e acesse o painel.

## Cloudflare

Crie um API Token na Cloudflare com permissões de leitura e edição de DNS:

- Permissão: `Zone` > `Zone` > `Read`
- Permissão: `Zone` > `DNS` > `Read`
- Permissão: `Zone` > `DNS` > `Edit`
- Recurso: inclua a zona/domínio que será sincronizado

Depois preencha no `.env`:

```env
CLOUDFLARE_API_TOKEN="seu-token"
```

No MiniHost, edite o domínio e informe o `Zone ID`. Em seguida, vá para `Registros DNS`, selecione o domínio e clique em `Sincronizar com Cloudflare`.

Para criar um registro real, abra `Registros DNS`, clique em `Novo registro DNS`, preencha o formulário e marque `Criar registro real na Cloudflare`. Se a opção ficar desmarcada, o MiniHost cria apenas um registro local/manual no PostgreSQL.

Registro local/manual:

- Fica salvo apenas no PostgreSQL.
- Não altera a Cloudflare.
- Aparece com origem `Manual`.

Registro real Cloudflare:

- É criado pela API interna do MiniHost no endpoint backend `/api/cloudflare/create-record`.
- Usa o token apenas no servidor via `CLOUDFLARE_API_TOKEN`.
- É salvo no PostgreSQL com `cloudflareRecordId`, origem `Cloudflare` e data de sincronização.

Nesta etapa, o MiniHost cria DNS real apenas no fluxo de novo registro. Editar e excluir DNS real ainda não foram implementados.

## Build

```bash
npm run build
```

## Testes de navegador

```bash
npm run test:e2e
```

Os testes E2E usam Playwright e cobrem login, logout, proteção de rotas, navegação, CRUD de domínios, CRUD de registros DNS, histórico e persistência das configurações no PostgreSQL.

## Próximas etapas sugeridas

1. Editar registros DNS reais na Cloudflare com confirmação explícita.
2. Excluir registros DNS reais na Cloudflare com confirmação explícita.
3. Melhorar comparação antes/depois da sincronização.
4. Integrar com Coolify futuramente.

## Observação

Ainda não há edição ou exclusão de DNS real. Também não há integração com Coolify.
