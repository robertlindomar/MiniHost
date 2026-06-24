# MiniHost

MiniHost é um painel web para organizar domínios, registros DNS, projetos, bancos PostgreSQL e recursos Coolify da sua VPS.

Hoje o painel integra com PostgreSQL (metadados e provisionamento real), Cloudflare (sincronização e CRUD de DNS) e Coolify em modo somente leitura. O objetivo futuro é evoluir para deploy automatizado com Coolify.

## Etapa 12 implementada

- Model `CoolifyCredential` no Prisma com URL base, token criptografado, status e último teste.
- Models de cache `CoolifyServer`, `CoolifyProject` e `CoolifyApplication`.
- Model `ProjectCoolifyLink` para vincular um projeto MiniHost a um projeto/aplicação Coolify sincronizado.
- Serviço backend `lib/coolify.ts` para listar servidores, projetos e aplicações via API do Coolify.
- Rotas protegidas:
  - `POST /api/settings/coolify` para salvar URL/token.
  - `DELETE /api/settings/coolify` para remover a credencial.
  - `POST /api/settings/coolify/test` para testar conexão.
  - `GET /api/coolify` para listar cache local.
  - `POST /api/coolify/sync` para sincronizar recursos.
  - `POST /api/projects/[id]/coolify-link` e `DELETE .../coolify-link` para vincular/desvincular projeto.
- Nova página **Coolify** no menu lateral com status de conexão, servidores, projetos, aplicações e botão **Sincronizar recursos**.
- Seção **Coolify** em Configurações para URL base, token, último teste e ações de salvar/trocar/remover/testar.
- Seção **Coolify** nos detalhes do projeto para vincular recursos sincronizados.
- Dashboard com cards de aplicações Coolify sincronizadas, projetos vinculados e projetos sem vínculo.
- Histórico/AuditLog com ações `COOLIFY_CREDENTIAL_SAVED`, `COOLIFY_CREDENTIAL_REMOVED`, `COOLIFY_TEST_SUCCESS`, `COOLIFY_TEST_FAILED`, `COOLIFY_SYNC_START`, `COOLIFY_SYNC_SUCCESS`, `COOLIFY_SYNC_FAILED`, `PROJECT_COOLIFY_LINK_CREATED` e `PROJECT_COOLIFY_LINK_REMOVED`.

**Importante:** esta etapa é **somente leitura** no Coolify. O MiniHost não cria aplicações, não altera configurações, não executa deploys, não reinicia serviços e não exclui recursos do Coolify.

### Configurar Coolify

1. No Coolify, crie um API Token com permissão suficiente para listar recursos.
2. Acesse **Configurações** no MiniHost.
3. Na seção **Coolify**, informe a URL base do painel, por exemplo `https://coolify.exemplo.com`.
4. Cole o token da API e clique em **Salvar configuração**.
5. Clique em **Testar conexão**.

O token:

- É salvo criptografado na tabela `coolify_credentials`.
- Nunca é retornado ao frontend após salvo.
- Nunca deve ser colocado no código-fonte.
- Só é descriptografado no backend quando a API interna do MiniHost chama o Coolify.

### Sincronizar recursos Coolify

1. Acesse **Coolify** no menu lateral.
2. Clique em **Sincronizar recursos**.
3. O MiniHost lista servidores, projetos e aplicações via backend e salva snapshots locais no PostgreSQL.

As tabelas mostram dados em cache local como nome, FQDN, status, repositório, branch e última sincronização.

### Vincular projeto MiniHost ao Coolify

1. Sincronize recursos na página **Coolify**.
2. Abra um projeto MiniHost em **Projetos**.
3. Na seção **Coolify**, selecione o projeto e/ou aplicação sincronizada.
4. Clique em **Salvar vínculo**.

Esse vínculo é apenas organizacional nesta etapa. Ele não executa deploy nem modifica o Coolify.

## Etapa 11.5 implementada

- **Zona de perigo** na tela de detalhes do banco PostgreSQL.
- **Arquivar**: marca `ARCHIVED` no MiniHost sem alterar o PostgreSQL.
- **Desativar acesso**: revoga `CONNECT`, encerra conexões ativas e marca `DISABLED`.
- **Reativar acesso**: restaura `CONNECT` e marca `ACTIVE`.
- **Destruir banco e usuário**: `DROP DATABASE` + `DROP ROLE` com confirmação forte (`destruir nome_db`).
- Proteções contra destruição de `postgres`, `minihost`, bancos `template*` e usuário admin.
- Status `DESTROYED` e `PARTIALLY_DESTROYED` com histórico preservado no MiniHost.
- Filtro na listagem: Padrão (sem destruídos), Ativos, Desativados, Arquivados, Destruídos, Todos.
- Campos de auditoria: `disabledAt`, `disabledBy`, `destroyedAt`, `destroyedBy`, `lastDestructionError`.
- Rotas: `POST .../disable-access`, `POST .../enable-access`, `POST .../destroy`.
- AuditLog: `PROJECT_DATABASE_DISABLE_ACCESS`, `PROJECT_DATABASE_ENABLE_ACCESS`, `PROJECT_DATABASE_DESTROY_START`, `PROJECT_DATABASE_DESTROY_SUCCESS`, `PROJECT_DATABASE_DESTROY_PARTIAL`, `PROJECT_DATABASE_DESTROY_FAILED`.

**Diferenças importantes:**

| Ação | PostgreSQL | Registro MiniHost |
|------|------------|-------------------|
| Arquivar | Intacto | `ARCHIVED` |
| Desativar | Revoga CONNECT | `DISABLED` |
| Destruir | Remove banco e usuário | `DESTROYED` (histórico) |

**Aviso:** destruir é **irreversível** no PostgreSQL. O registro permanece no MiniHost para auditoria. `DROP DATABASE` não roda dentro de transação Prisma — cada comando usa conexão administrativa separada via `pg`.

### Zona de perigo — como usar

1. Abra os detalhes do banco na seção **Bancos PostgreSQL** do projeto.
2. Role até **Zona de perigo** (visível para bancos que ainda não foram destruídos ou arquivados de forma definitiva).
3. Escolha a ação:
   - **Arquivar** — apenas no MiniHost; o PostgreSQL permanece intacto.
   - **Desativar acesso** — revoga `CONNECT`, encerra sessões ativas; disponível para bancos `ACTIVE` ou `CREATED_MANUALLY`.
   - **Reativar acesso** — restaura `CONNECT`; disponível apenas para bancos `DISABLED`.
   - **Destruir banco e usuário** — `DROP DATABASE` + `DROP ROLE`; digite exatamente `destruir nome_db` (ex.: `destruir systagio_db`).
4. Use o filtro da listagem para ver **Desativados**, **Arquivados**, **Destruídos** ou **Todos**. O padrão oculta bancos destruídos.

Se apenas parte da destruição for concluída (por exemplo, banco removido mas usuário não), o status fica `PARTIALLY_DESTROYED` e o erro em `lastDestructionError`.

## Etapa 11 implementada

- Model `PostgresAdminCredential` no Prisma com credencial administrativa criptografada.
- Novos status em `ProjectDatabase`: `PROVISIONING` e `FAILED`, com `provisionedAt`, `provisionedBy` e `lastProvisionError`.
- Seção **Credencial administrativa PostgreSQL** em Configurações (host, porta, database de manutenção, usuário, senha, SSL).
- Teste de conexão admin via `POST /api/settings/postgres/test`.
- Serviço `lib/server/postgres-provisioner.ts` com criação real de usuário e banco via biblioteca `pg`.
- Isolamento por projeto: `REVOKE CONNECT ON DATABASE ... FROM PUBLIC` e `GRANT CONNECT` apenas ao usuário do banco.
- Botão **Criar banco real** na tela do banco planejado, com modal de confirmação forte (`criar banco nome_db`).
- **Verificar permissões** e **Corrigir permissões** para bancos `ACTIVE` ou `CREATED_MANUALLY` (confirmação: `corrigir permissoes nome_db`).
- Rotas: `POST /api/projects/databases/provision`, `POST .../verify-permissions`, `POST .../fix-permissions`.
- Validação de identificadores PostgreSQL antes de montar SQL.
- Senhas nunca expostas no frontend após salvar e nunca registradas no AuditLog.
- Histórico: `POSTGRES_ADMIN_CREDENTIAL_SAVED`, `POSTGRES_ADMIN_CREDENTIAL_REMOVED`, `POSTGRES_ADMIN_TEST_SUCCESS`, `POSTGRES_ADMIN_TEST_FAILED`, `PROJECT_DATABASE_PROVISION_START`, `PROJECT_DATABASE_PROVISION_SUCCESS`, `PROJECT_DATABASE_PROVISION_FAILED`, `PROJECT_DATABASE_PERMISSIONS_VERIFIED`, `PROJECT_DATABASE_PERMISSIONS_FIXED`.
- Dashboard atualizado com bancos com erro e projetos sem banco ativo.
- Mantidos geradores de `.env` e SQL manual.

**Importante:** esta etapa **não integra com Coolify** e **não automatiza deploy**. O foco é criar bancos PostgreSQL reais com segurança a partir dos bancos planejados.

### Configurar credencial administrativa PostgreSQL

1. Acesse **Configurações** → **Credencial administrativa PostgreSQL**.
2. Informe host, porta, database de manutenção (ex.: `postgres`), usuário admin e senha.
3. Ative SSL se necessário.
4. Clique em **Salvar credencial** (a senha não será exibida novamente).
5. Clique em **Testar conexão** para validar.

### Permissões necessárias no PostgreSQL

O usuário administrativo precisa de permissões para criar roles e databases, por exemplo:

```sql
ALTER USER seu_admin WITH CREATEROLE CREATEDB;
```

Ou use um superusuário dedicado apenas em ambientes confiáveis.

### Criar banco real

1. Crie um banco planejado no projeto (com senha gerada ou informada).
2. Configure e teste a credencial administrativa.
3. Abra os detalhes do banco e clique em **Criar banco real**.
4. Revise o preview e digite a confirmação exata (ex.: `criar banco systagio_db`).
5. Após sucesso, o status muda para **Ativo**.

**Avisos de segurança:**

- Não use credencial admin em ambientes inseguros ou expostos publicamente.
- Nunca commite arquivos `.env` com senhas ou `DATABASE_URL`.
- O AuditLog nunca registra senhas nem URLs completas com credenciais.

**Próxima etapa sugerida (concluída na 11.5):** desprovisionamento seguro (arquivar, desativar acesso, destruir). Depois: integrar com Coolify para deploy automatizado.

## Etapa 10 implementada

- Model `ProjectDatabase` no Prisma com status `PLANNED`, `CREATED_MANUALLY`, `ACTIVE`, `DISABLED` e `ARCHIVED`.
- Senha e `DATABASE_URL` salvos criptografados com `MINIHOST_ENCRYPTION_KEY`.
- Seção **Bancos PostgreSQL** na tela de detalhes do projeto.
- Criar banco planejado com sugestões automáticas baseadas no slug do projeto.
- Configurações globais **PostgreSQL padrão** (host, porta, sufixos de database e usuário).
- Gerador de `.env` com confirmação sensível.
- Gerador de SQL manual para execução no pgAdmin/terminal.
- Rotação de senha com exibição única após gerar.
- Histórico: `PROJECT_DATABASE_CREATE`, `PROJECT_DATABASE_UPDATE`, `PROJECT_DATABASE_ARCHIVE`, `PROJECT_DATABASE_ENV_GENERATED`, `PROJECT_DATABASE_SQL_GENERATED`, `PROJECT_DATABASE_PASSWORD_ROTATED`.
- Dashboard com cards de bancos e indicador de projetos sem banco.
- Lista de projetos com contadores DNS e DB.

**Importante:** esta etapa **não cria banco real automaticamente**, **não conecta como admin no PostgreSQL** e **não integra com Coolify**. O foco é planejar/registrar bancos, gerar credenciais e exportar `.env`/SQL.

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

## Bancos PostgreSQL por projeto

Fluxo completo: planejar → provisionar (opcional) → gerar `.env`/SQL → gerenciar permissões → zona de perigo.

### Configurar PostgreSQL padrão

1. Acesse `Configurações`.
2. Na seção **PostgreSQL padrão**, informe host, porta e sufixos.
3. Exemplo: host `postgres.robertlindomar.dev`, porta `5432`, sufixo database `_db`, sufixo usuário `_user`.
4. Salve as configurações.

### Criar banco planejado

1. Abra os detalhes de um projeto.
2. Na seção **Bancos PostgreSQL**, clique em `Novo banco PostgreSQL`.
3. Revise as sugestões automáticas (`systagio_db`, `systagio_user`, etc.).
4. Marque **Gerar senha automaticamente** ou informe uma senha com pelo menos 16 caracteres.
5. A senha gerada é exibida **apenas uma vez** após criar.

### Gerar .env

1. Na tabela ou nos detalhes do banco, clique em `Gerar .env`.
2. Confirme a ação sensível.
3. Copie o bloco gerado com `DATABASE_URL` e variáveis `POSTGRES_*`.
4. **Não compartilhe publicamente** — contém credenciais.

### Gerar SQL manual

1. Clique em `Gerar SQL manual` nos detalhes do banco.
2. Confirme a ação sensível.
3. Copie o SQL com `CREATE USER`, `CREATE DATABASE` e `GRANT`.
4. **Revise antes de executar em produção** no pgAdmin ou terminal.

### Criar banco real (Etapa 11)

1. Configure e teste a **Credencial administrativa PostgreSQL** em Configurações.
2. Abra os detalhes do banco planejado e clique em **Criar banco real**.
3. Digite a confirmação exata (ex.: `criar banco systagio_db`).
4. Após sucesso, o status muda para **Ativo**. Em caso de falha, fica **Erro** com `lastProvisionError`.

### Verificar e corrigir permissões

Para bancos ativos ou criados manualmente:

1. Clique em **Verificar permissões** para checar `CONNECT` do usuário e alertas de `PUBLIC`.
2. Se necessário, clique em **Corrigir permissões** e confirme com `corrigir permissoes nome_db`.

### Zona de perigo (Etapa 11.5)

Na tela de detalhes do banco, use **Arquivar**, **Desativar acesso**, **Reativar acesso** ou **Destruir banco e usuário**. Veja a seção **Etapa 11.5 implementada** para diferenças entre cada ação.

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

1. Planejar templates de deploy/projetos para usar recursos Coolify vinculados.
2. Implementar criação assistida de aplicações Coolify com confirmação explícita.
3. Melhorar comparação antes/depois da sincronização DNS.
4. Backup e restauração de bancos PostgreSQL por projeto.

## Observação

O MiniHost já provisiona e desprovisiona bancos PostgreSQL reais (com confirmação forte), sincroniza e edita DNS na Cloudflare, lista recursos Coolify em modo leitura e mantém histórico/auditoria no PostgreSQL. Deploy automatizado via Coolify ainda não foi implementado.
