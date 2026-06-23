# MiniHost

MiniHost é um painel web simples para organizar domínios, subdomínios e registros DNS da sua VPS.

O objetivo futuro do projeto é evoluir para uma plataforma de gestão e automação usando PostgreSQL, Cloudflare, Coolify e deploys em VPS.

## Etapa 9 implementada

- Model `Project` no Prisma com status `DRAFT`, `ACTIVE`, `PAUSED` e `ARCHIVED`.
- Relacionamento opcional `projectId` em `DnsRecord`.
- Página **Projetos** (`/projects`) com listagem, busca e filtros por status.
- CRUD de projetos: criar, editar, listar, ver detalhes e arquivar (sem exclusão permanente).
- Página de detalhes do projeto (`/projects/[id]`).
- Vincular registros DNS existentes a um projeto.
- Desvincular registros DNS de um projeto sem excluir o registro.
- Criar DNS por template dentro do projeto (API, App, Painel, Subdomínio).
- Registros criados dentro do projeto salvam `projectId` automaticamente.
- Coluna **Projeto** na tabela geral de registros DNS.
- Filtros na tabela DNS: Todos, Sem projeto, Por projeto.
- Dashboard com cards de projetos e seção **Projetos recentes**.
- Histórico com ações: `PROJECT_CREATE`, `PROJECT_UPDATE`, `PROJECT_ARCHIVE`, `DNS_RECORD_LINK_PROJECT`, `DNS_RECORD_UNLINK_PROJECT`, `DNS_RECORD_CREATE_FROM_PROJECT_TEMPLATE`.
- Item **Projetos** no menu lateral.

**Importante:** projetos ainda **não** criam banco PostgreSQL, **não** integram com Coolify e **não** automatizam deploy. Esta etapa é apenas para organizar registros DNS.

## Etapa 8 implementada

- Layout principal com sidebar, header e navegação entre telas.
- Prisma ORM configurado com PostgreSQL.
- Models `User`, `Domain`, `DnsRecord`, `AppSetting`, `CloudflareCredential` e `AuditLog`.
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
- Página `Templates DNS` com modelos prontos para registros comuns.
- Atalhos `Templates rápidos` no Dashboard.
- Criação por template reutilizando as rotas existentes de criação local e Cloudflare.
- Histórico específico para criação por template local ou Cloudflare.
- **Etapa 8.6: token Cloudflare cadastrado pelo painel, salvo criptografado no PostgreSQL.**
- Tratamento de erro quando o banco está indisponível.
- Loading states simples nas telas e ações.

## Configurar ambiente

```bash
npm install
cp .env.example .env
```

Configure o `.env`:

```env
DATABASE_URL="postgresql://postgres:123@localhost:5432/minihost?schema=public"
AUTH_SECRET="troque-este-segredo-em-producao"
MINIHOST_ENCRYPTION_KEY="troque-por-uma-chave-segura"
```

`MINIHOST_ENCRYPTION_KEY` é obrigatória para criptografar e descriptografar o token da Cloudflare no servidor. Gere uma chave forte, por exemplo:

```bash
openssl rand -base64 32
```

**Importante:** nunca commite o arquivo `.env`. Versões antigas usavam `CLOUDFLARE_API_TOKEN` no `.env`; a partir da Etapa 8.6 o token é cadastrado em `Configurações` no painel.

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

### Etapa 8.6 — Token pelo painel

1. Acesse `Configurações` no MiniHost.
2. Cole o token em `Cloudflare API Token` e clique em `Salvar token`.
3. Informe o `Zone ID padrão`.
4. Clique em `Testar conexão` para validar token e zona.
5. Para trocar o token, use `Trocar token`. Para remover, use `Remover token` (com confirmação).

O token:

- É salvo **criptografado** na tabela `cloudflare_credentials`.
- **Nunca** é retornado ao frontend após salvo.
- **Nunca** aparece em logs ou `AuditLog`.
- Só é descriptografado no backend quando necessário.

O status na sidebar reflete o último teste:

- `Cloudflare conectado` — último teste com sucesso
- `Cloudflare não configurado` — sem token salvo
- `Cloudflare com erro` — último teste falhou
- `Cloudflare não testado` — token salvo, mas ainda não testado

No MiniHost, edite o domínio e informe o `Zone ID`. Em seguida, vá para `Registros DNS`, selecione o domínio e clique em `Sincronizar com Cloudflare`.

Para criar um registro real, abra `Registros DNS`, clique em `Novo registro DNS`, preencha o formulário e marque `Criar registro real na Cloudflare`. Se a opção ficar desmarcada, o MiniHost cria apenas um registro local/manual no PostgreSQL.

Registro local/manual:

- Fica salvo apenas no PostgreSQL.
- Não altera a Cloudflare.
- Aparece com origem `Manual`.

Registro real Cloudflare:

- É criado pela API interna do MiniHost no endpoint backend `/api/cloudflare/create-record`.
- Usa o token salvo e criptografado no PostgreSQL, descriptografado apenas no servidor.
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

## Templates DNS

Os templates ajudam a criar registros comuns sem preencher tudo manualmente.

Templates disponíveis:

- `Subdomínio para VPS`: registro `A` com nome preenchido pelo usuário e IP padrão da VPS.
- `API`: registro `A` sugerindo `api`.
- `Painel/Admin`: registro `A` sugerindo `painel`.
- `App/Frontend`: registro `A` sugerindo `app`.
- `www para domínio raiz`: registro `CNAME` de `www` para o domínio raiz.
- `Verificação TXT`: registro `TXT` com nome e conteúdo preenchidos pelo usuário.
- `Subdomínio sem proxy`: registro `A` com proxy desativado.

Antes de usar templates que apontam para a VPS, configure `Configurações > IP padrão da VPS`. Se o IP não estiver configurado, o MiniHost bloqueia o uso desses templates e mostra um aviso.

Para usar:

1. Vá em `Templates DNS`.
2. Clique em `Usar template`.
3. Revise nome, conteúdo, proxy e comentário.
4. Confira o preview do registro final.
5. Escolha `Criar apenas localmente` ou `Criar na Cloudflare`.

Diferença:

- `Criar apenas localmente` usa `POST /api/records` e salva só no PostgreSQL.
- `Criar na Cloudflare` usa `POST /api/cloudflare/create-record`, cria o DNS real e salva `cloudflareRecordId` no PostgreSQL.

O Dashboard também mostra atalhos rápidos para `Novo API`, `Novo Painel`, `Novo App` e `Novo Subdomínio`.

## Projetos

Projetos agrupam registros DNS relacionados a um mesmo sistema ou aplicação.

### Criar projeto

1. Acesse `Projetos` no menu lateral.
2. Clique em `Novo projeto`.
3. Preencha nome, slug, descrição, status e domínio principal.
4. O slug deve ser único e conter apenas letras minúsculas, números e hífen (ex.: `systagio`).

### Vincular DNS existente

1. Abra os detalhes do projeto (`Ver detalhes`).
2. Clique em `Vincular DNS existente`.
3. Selecione os registros desejados (apenas registros sem projeto aparecem).
4. Confirme com `Vincular ao projeto`.

Para desvincular, use `Desvincular` na tabela de registros do projeto. O registro DNS permanece no sistema.

### Criar DNS por template dentro do projeto

Na tela de detalhes do projeto, use os atalhos:

- `Novo API`
- `Novo App`
- `Novo Painel`
- `Novo Subdomínio`

Eles reutilizam a lógica dos Templates DNS. A diferença é que o novo registro é salvo com `projectId` do projeto automaticamente.

### Arquivar projeto

Na listagem de projetos, clique em `Arquivar`. O projeto muda para status `ARCHIVED` e recebe `archivedAt`, mas os registros DNS vinculados **não são excluídos**.

## Build

```bash
npm run build
```

## Testes de navegador

```bash
npm run test:e2e
```

Os testes E2E usam Playwright e cobrem login, logout, proteção de rotas, navegação, CRUD de domínios, CRUD de registros DNS, templates, histórico e persistência das configurações no PostgreSQL.

## Próximas etapas sugeridas

1. Módulo de banco PostgreSQL por projeto.
2. Melhorar comparação antes/depois da sincronização.
3. Integrar com Coolify futuramente.

## Observação

A exclusão real na Cloudflare já está disponível com confirmação forte. Projetos organizam DNS, mas ainda não criam banco nem integram com Coolify.
