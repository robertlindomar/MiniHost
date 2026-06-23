# MiniHost

MiniHost é um painel web simples para organizar domínios, subdomínios e registros DNS da sua VPS.

O objetivo futuro do projeto é evoluir para uma plataforma de gestão e automação usando PostgreSQL, Cloudflare, Coolify e deploys em VPS.

## Etapa 7 implementada

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
- Edição de registros DNS reais na Cloudflare pelo MiniHost.
- **Exclusão de registros DNS reais na Cloudflare com confirmação forte.**
- Opção de criar registros apenas localmente ou criar também na Cloudflare.
- Identificação visual da origem do registro: Manual ou Cloudflare.
- Validações para registros `A`, `AAAA`, `CNAME`, `TXT` e `MX`.
- Bloqueio de duplicidade e conflito entre `CNAME` e `A/AAAA`.
- Tipo do registro bloqueado/read-only na edição.
- Resumo antes/depois com confirmação explícita antes de editar na Cloudflare.
- Edição local para registros sem `cloudflareRecordId`.
- **Soft delete: registros excluídos permanecem no PostgreSQL com status `DELETED`.**
- **Confirmação digitada obrigatória antes de excluir (ex.: `api.robertlindomar.dev`).**
- **Filtro na tabela: Ativos, Excluídos e Todos.**
- **Avisos extras para registros sensíveis na exclusão.**
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

## Editar registro DNS real

Para editar um registro vinculado à Cloudflare:

1. Vá em `Registros DNS`.
2. Clique em `Editar` no registro desejado.
3. O **tipo do registro fica bloqueado** na edição. Para trocar o tipo (por exemplo, de `A` para `CNAME`), crie um novo registro.
4. Altere nome, valor, TTL, proxy ou comentário.
5. Clique em `Salvar alterações`.
6. Revise o resumo **Antes/Depois** e confirme com `Confirmar alteração real na Cloudflare`.

A edição real passa pelo backend em `PATCH /api/cloudflare/update-record`, que chama a Cloudflare com `PATCH /zones/{zone_id}/dns_records/{dns_record_id}`.

Registro local/manual na edição:

- Se o registro **não** tiver `cloudflareRecordId`, a edição é apenas local.
- O MiniHost mostra o aviso: "Este registro não está vinculado à Cloudflare. A edição será apenas local."
- A rota usada é `PATCH /api/records/{id}`.

Nesta etapa, o MiniHost **não exclui** DNS real na Cloudflare. A exclusão pelo painel remove apenas o registro do PostgreSQL.

## Excluir registro DNS real

Para excluir um registro vinculado à Cloudflare:

1. Vá em `Registros DNS`.
2. Clique em `Excluir` no registro desejado.
3. Revise domínio, tipo, nome, conteúdo e proxy no modal.
4. Leia o aviso de risco. Registros sensíveis (`@`, `www`, `mail`, `MX`, `TXT`, SPF, DKIM, DMARC) mostram alerta extra.
5. Informe o motivo da exclusão, se quiser.
6. Digite exatamente o nome do registro, por exemplo: `api.robertlindomar.dev`
7. Confirme com `Excluir da Cloudflare`.

A exclusão real passa pelo backend em `DELETE /api/cloudflare/delete-record`, que chama a Cloudflare com `DELETE /zones/{zone_id}/dns_records/{dns_record_id}`.

Registro local/manual na exclusão:

- Se o registro **não** tiver `cloudflareRecordId`, ele é marcado como `DELETED` apenas no MiniHost.
- O MiniHost mostra: "Este registro não está vinculado à Cloudflare. Ele será removido apenas do MiniHost."
- A rota usada é `DELETE /api/records/{id}`.

Registros excluídos:

- **Não são apagados permanentemente** do PostgreSQL.
- Ficam com `status = DELETED`, `deletedAt`, `deletedBy` e `deletionReason`.
- O `cloudflareRecordId` é mantido para histórico.
- Por padrão, a tabela mostra apenas registros **Ativos**. Use o filtro para ver **Excluídos** ou **Todos**.

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

1. Templates rápidos para criação de subdomínios.
2. Melhorar comparação antes/depois da sincronização.
3. Integrar com Coolify futuramente.

## Observação

A exclusão real na Cloudflare já está disponível com confirmação forte. Ainda não há integração com Coolify.
