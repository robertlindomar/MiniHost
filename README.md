# MiniHost

MiniHost é um painel web para organizar domínios, registros DNS, projetos, bancos PostgreSQL e recursos Coolify da sua VPS.

Hoje o painel integra com PostgreSQL (metadados e provisionamento real), Cloudflare (sincronização e CRUD de DNS) e Coolify (sincronização de recursos e criação de aplicações a partir de repositórios públicos). O objetivo futuro é evoluir para deploy automatizado completo com repositórios privados e ações destrutivas controladas.

## Etapa 16 implementada

- **Zona de perigo** no detalhe do projeto (`/projects/[id]`) com ações separadas: **Arquivar** (local) e **Encerrar projeto e infraestrutura** (destrutivo).
- Orquestrador `POST /api/projects/terminate` com checklist etapa a etapa, confirmação forte `encerrar slug-do-projeto` e opções selecionáveis (DNS, apps Coolify, projeto Coolify, bancos).
- Preview de recursos: `GET /api/projects/[id]/terminate-preview`.
- Novos status de projeto: `TERMINATING`, `TERMINATED`, `TERMINATED_WITH_ERRORS`.
- Falha parcial com pendências persistidas e botão **Tentar novamente pendências**.
- Bancos PostgreSQL **preservados por padrão**; destruição só com opção explícita (reutiliza desprovisionamento seguro da Etapa 11.5).
- Proteções: slug `minihost`, banco/usuário `postgres`/`minihost`, domínio raiz do painel (não subdomínios), registro DNS apex `@` do painel, apps MiniHost.
- AuditLog `PROJECT_TERMINATE_*` sem dados sensíveis.

## Etapa 17 implementada

### Modelo mental do MiniHost

**1 Project MiniHost = 1 CoolifyProject; N aplicações dentro; DNS e bancos no projeto MiniHost.**

- `ProjectCoolifyLink` vincula apenas **projeto MiniHost → CoolifyProject** (sem `coolifyApplicationCacheId`).
- Campos novos: `source` (`PUBLISH`, `MANUAL_LINK`, `BACKFILL`, `IMPORT`) e `createdByMiniHost`.
- Serviço central `lib/server/project-coolify-project.ts`: `ensureProjectCoolifyProject`, backfill automático, detecção e correção de inconsistências.
- **Publicar** e o provisioner de aplicações chamam `ensureProjectCoolifyProject` após criar/selecionar o projeto Coolify.
- Na UI do projeto: card único **Projeto Coolify deste projeto** (sem seletor de app Coolify no nível do projeto).
- Nas aplicações: o projeto Coolify é **herdado** do projeto MiniHost — não há picker de projeto por app.
- Encerramento usa `ProjectCoolifyLink` como fonte principal para localizar o projeto Coolify (fallback legado via apps vinculadas).

### Backfill e inconsistências

- Ao abrir o detalhe do projeto, o MiniHost tenta backfill seguro quando detecta inconsistência (ex.: apps com `coolifyProjectId` mas sem link no projeto).
- A seção Coolify mostra alertas e permite corrigir via `POST /api/projects/[id]/coolify-project/fix`.
- Dashboard exibe cards: projetos com/sem Coolify, inconsistentes e vínculos quebrados.

### Fluxo recomendado

1. Crie ou vincule o **projeto Coolify** no card do projeto MiniHost (ou use **Publicar**, que cria o link automaticamente).
2. Planeje aplicações na seção **Aplicações** — elas usam o mesmo CoolifyProject.
3. Crie ou vincule cada aplicação no Coolify individualmente (servidor + app; projeto herdado).

## Etapa 15 implementada

- Nova área **Publicar** (`/publicar`) com fluxo unificado para aplicações **Static**.
- Wizard em uma única página com seções: Projeto, Domínio/DNS, Aplicação Static, Coolify e Revisão.
- Orquestrador `POST /api/publish/static` reutilizando serviços existentes (projeto, DNS Cloudflare, aplicação planejada, Coolify, envs, deploy e sync).
- Confirmação forte: `publicar slug-do-projeto`.
- Checklist de execução com status por etapa: Pendente, Executando, Sucesso, Erro, Ignorado.
- Tratamento de falha parcial: mostra o que foi criado e orienta continuar no modo avançado.
- Item **Publicar** no menu lateral e atalho **Publicar novo projeto** no Dashboard.
- AuditLog:
  - `STATIC_PUBLISH_START`
  - `STATIC_PUBLISH_PROJECT_CREATED`
  - `STATIC_PUBLISH_DNS_CREATED`
  - `STATIC_PUBLISH_DNS_LINKED`
  - `STATIC_PUBLISH_APPLICATION_CREATED`
  - `STATIC_PUBLISH_COOlify_PROJECT_CREATED`
  - `STATIC_PUBLISH_COOlify_CREATED`
  - `STATIC_PUBLISH_ENVS_APPLIED`
  - `STATIC_PUBLISH_DEPLOY_STARTED`
  - `STATIC_PUBLISH_SYNC_COMPLETED`
  - `STATIC_PUBLISH_SUCCESS`
  - `STATIC_PUBLISH_FAILED`

**Importante:** esta etapa cobre apenas **Static** com repositório público HTTPS. Backend, Fullstack, repositório privado e criação de banco PostgreSQL ficam para etapas futuras. As telas antigas (**Projetos**, **Domínios**, **Registros DNS**, **Coolify**, detalhes da aplicação) continuam como **modo avançado**.

### Como usar o fluxo Publicar

1. Acesse **Publicar** no menu ou **Publicar novo projeto** no Dashboard.
2. Preencha projeto, DNS (criar, vincular existente ou pular), aplicação Static e destino Coolify.
3. Revise o preview e confirme com `publicar slug-do-projeto`.
4. Clique em **Executar publicação** e acompanhe o checklist.
5. Ao final, use os links para abrir o projeto, o site ou o Coolify.

### Exemplo Static

- Projeto: `Portfolio` / slug `portfolio`
- DNS: criar registro `A` `portfolio` → IP da VPS (default das Configurações)
- App: repo público Vite, `npm run build`, output `/dist`
- Coolify: criar app, aplicar envs (se houver), deploy e sincronizar

### Falha parcial

Se uma etapa falhar após criar recursos anteriores, o MiniHost **não apaga** o que já foi criado. A tela de resultado mostra o checklist, o que foi salvo e botões para abrir o projeto e continuar manualmente em **Projetos** → detalhes da aplicação.

## Etapa 14 implementada

- Criação de aplicação **real** no Coolify a partir de uma `ProjectApplication` planejada.
- Suporte apenas a **repositório público via HTTPS** nesta etapa.
- Serviço `createPublicRepositoryApplication()` em `lib/coolify.ts` usando `POST /api/v1/applications/public`.
- Pós-provisionamento em etapas separadas:
  - `updateApplicationEnvs()` — `PATCH /api/v1/applications/{uuid}/envs/bulk`
  - `deployApplication()` — `GET /api/v1/deploy?uuid=...`
- Rotas protegidas:
  - `POST /api/coolify/applications/create-public` — confirmação `criar app slug-da-aplicacao`
  - `POST /api/coolify/applications/apply-envs` — confirmação `aplicar envs slug-da-aplicacao`
  - `POST /api/coolify/applications/deploy` — confirmação `deploy slug-da-aplicacao`
- Modal de criação com opções opcionais (desmarcadas por padrão): **Aplicar envs após criar** e **Iniciar deploy após criar**.
- Checklist visual na tela de detalhes: aplicação criada, variáveis aplicadas, deploy iniciado e última sincronização.
- Botões na tela de detalhes: **Criar no Coolify**, **Aplicar variáveis no Coolify**, **Deploy no Coolify**, **Abrir no Coolify** e **Sincronizar status**.
- Status local após criação: sempre `LINKED` (não `DEPLOYED` automaticamente).
- Novos status: `ENVS_APPLIED` e `DEPLOYING`.
- Novos campos em `ProjectApplication`: `envsAppliedAt`, `lastEnvsApplyStatus`, `lastEnvsApplyMessage`, `lastDeployStartedAt`, `lastDeployStatus`, `lastDeployMessage`, `lastCoolifySyncAt`.
- Dashboard atualizado com cards de apps vinculados, com erro de provisionamento e pendentes de criação no Coolify.
- AuditLog:
  - `COOLIFY_APPLICATION_CREATE_START`
  - `COOLIFY_APPLICATION_CREATE_SUCCESS`
  - `COOLIFY_APPLICATION_CREATE_FAILED`
  - `COOLIFY_APPLICATION_ENVS_APPLY_START`
  - `COOLIFY_APPLICATION_ENVS_APPLY_SUCCESS`
  - `COOLIFY_APPLICATION_ENVS_APPLY_FAILED`
  - `COOLIFY_APPLICATION_DEPLOY_START`
  - `COOLIFY_APPLICATION_DEPLOY_SUCCESS`
  - `COOLIFY_APPLICATION_DEPLOY_FAILED`
  - `PROJECT_APPLICATION_PROVISIONED_COOLIFY`

**Importante:** criar a aplicação no Coolify **não significa deploy automático**. O fluxo recomendado é: (1) criar app, (2) aplicar envs, (3) iniciar deploy, (4) sincronizar status. Esta etapa **não suporta repositório privado**, **GitHub App** nem **Deploy Key**. Também **não exclui, para ou reinicia** recursos no Coolify. O token Coolify e valores sensíveis **nunca** aparecem no frontend, logs ou AuditLog.

### Fluxo completo no Coolify

1. Configure URL e token do Coolify em **Configurações** e teste a conexão.
2. Sincronize recursos na página **Coolify**.
3. No projeto MiniHost, planeje uma aplicação com repositório público HTTPS, branch, domínio e comandos de build.
4. Para apps **STATIC**: banco é opcional, `DATABASE_URL` não é obrigatória, start command e porta podem ficar vazios; `build command` e `output directory` (ex.: `/dist`) são obrigatórios.
5. Abra **Ver detalhes** e clique em **Criar no Coolify**.
6. Revise o preview, confirme com `criar app slug-da-aplicacao` e crie. A aplicação ficará com status `LINKED`.
7. Se houver variáveis planejadas, clique em **Aplicar variáveis no Coolify** e confirme com `aplicar envs slug-da-aplicacao`.
8. Clique em **Deploy no Coolify** e confirme com `deploy slug-da-aplicacao`.
9. Use **Sincronizar status** para atualizar o cache e o status exibido no MiniHost.

Opcionalmente, no modal de criação, marque **Aplicar envs após criar** e/ou **Iniciar deploy após criar** para executar o fluxo completo em uma única ação.

### Limitações desta etapa

- Somente repositório público via HTTPS.
- Repositório privado, GitHub App e Deploy Key ficam para etapa futura.
- Não há exclusão, parada ou restart de aplicações no Coolify.

### Teste recomendado com repositório estático público

1. Crie um projeto de teste no MiniHost.
2. Planeje uma aplicação tipo **STATIC** apontando para um repositório público simples (ex.: site Vite/React com `npm run build` e output `/dist`).
3. Não vincule banco e deixe variáveis vazias — apps Static podem funcionar sem envs.
4. Crie a aplicação no Coolify, aplique envs (se houver) e inicie o deploy.
5. Clique em **Sincronizar status** e verifique o checklist e o status na página Coolify.

## Etapa 13 implementada

- Model `ProjectApplication` no Prisma para planejar aplicações/deploys por projeto.
- Status de aplicação: `DRAFT`, `READY`, `LINKED`, `ENVS_APPLIED`, `DEPLOYING`, `DEPLOYED`, `FAILED` e `ARCHIVED`.
- Tipos de aplicação: `FRONTEND`, `BACKEND`, `FULLSTACK`, `STATIC`, `DOCKERFILE`, `DOCKER_COMPOSE` e `OTHER`.
- Nova seção **Aplicações** dentro dos detalhes do projeto.
- Criar, editar, ver detalhes e arquivar aplicações planejadas.
- Campos de build/runtime: repositório Git, branch, diretório raiz, install/build/start command, output directory, porta, domínio e observações.
- Seleção de DNS já vinculado ao projeto para preencher o domínio da aplicação.
- Seleção de banco PostgreSQL do projeto para uso nas variáveis de ambiente.
- Variáveis de ambiente salvas criptografadas em `environmentVariablesEncrypted`.
- Importação de variáveis do banco PostgreSQL:
  - `DATABASE_URL`
  - `POSTGRES_HOST`
  - `POSTGRES_PORT`
  - `POSTGRES_DB`
  - `POSTGRES_USER`
  - `POSTGRES_PASSWORD`
- Gerador de bloco `.env` com confirmação sensível.
- Preview de deploy mostrando repo, branch, domínio, porta, comandos e status de DNS/banco/Coolify.
- Validação de prontidão para provisionamento futuro.
- Vínculo de uma aplicação planejada com uma aplicação Coolify já sincronizada.
- Dashboard com cards de aplicações planejadas, prontas, vinculadas ao Coolify e sem domínio.
- Histórico/AuditLog:
  - `PROJECT_APPLICATION_CREATE`
  - `PROJECT_APPLICATION_UPDATE`
  - `PROJECT_APPLICATION_ARCHIVE`
  - `PROJECT_APPLICATION_ENV_UPDATED`
  - `PROJECT_APPLICATION_ENV_GENERATED`
  - `PROJECT_APPLICATION_READY_CHECK`
  - `PROJECT_APPLICATION_LINK_COOLIFY`

**Importante:** esta etapa **não cria aplicação real no Coolify**, **não executa deploy** e **não altera recursos no Coolify**. Ela apenas prepara a configuração local para uma etapa futura de provisionamento.

### Criar uma aplicação planejada

1. Acesse **Projetos** e abra os detalhes de um projeto.
2. Na seção **Aplicações**, clique em **Nova aplicação**.
3. Preencha nome, tipo, repositório, branch, comandos, porta e domínio.
4. Se quiser, selecione um DNS já vinculado ao projeto para preencher o domínio automaticamente.
5. Salve a aplicação.

### Vincular DNS

Antes de criar ou editar a aplicação, vincule registros DNS ao projeto na seção **Registros DNS vinculados**. Depois, no formulário da aplicação, escolha o registro em **DNS vinculado**. O campo **Domínio** será preenchido com o FQDN correspondente.

### Vincular banco e gerar variáveis

1. Crie ou selecione um banco PostgreSQL do projeto.
2. Na aplicação, escolha o banco em **Banco PostgreSQL**.
3. Abra **Ver detalhes** da aplicação.
4. Clique em **Importar banco** para gerar as variáveis PostgreSQL.
5. Clique em **Gerar .env** e confirme a ação sensível para visualizar o bloco.

As variáveis são salvas criptografadas. O AuditLog registra nomes de variáveis e metadados, mas nunca registra valores sensíveis.

### Vincular aplicação Coolify existente

1. Sincronize recursos na página **Coolify**.
2. Abra os detalhes da aplicação planejada.
3. Na seção **Coolify**, selecione uma aplicação sincronizada.
4. Clique em **Vincular**.

Esse vínculo muda a aplicação local para `LINKED`, mas não executa deploy nem altera o Coolify.

## Etapa 12 implementada

- Model `CoolifyCredential` no Prisma com URL base, token criptografado, status e último teste.
- Models de cache `CoolifyServer`, `CoolifyProject` e `CoolifyApplication`, com status local, status remoto, última presença e marcação de removidos.
- Model `ProjectCoolifyLink` para vincular um projeto MiniHost a um projeto Coolify sincronizado (desde a Etapa 17, apenas CoolifyProject — ver seção Etapa 17).
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
- Dashboard com cards de recursos Coolify ativos, ausentes, removidos e projetos com vínculo quebrado.
- Histórico/AuditLog com ações `COOLIFY_CREDENTIAL_SAVED`, `COOLIFY_CREDENTIAL_REMOVED`, `COOLIFY_TEST_SUCCESS`, `COOLIFY_TEST_FAILED`, `COOLIFY_SYNC_START`, `COOLIFY_SYNC_SUCCESS`, `COOLIFY_SYNC_FAILED`, `COOLIFY_SYNC_RESOURCE_ACTIVE`, `COOLIFY_SYNC_RESOURCE_MISSING`, `COOLIFY_SYNC_RESOURCE_REMOVED`, `PROJECT_COOLIFY_LINK_CREATED`, `PROJECT_COOLIFY_LINK_REMOVED` e `PROJECT_COOLIFY_LINK_BROKEN`.

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

### Cache local e reconciliação Coolify

O MiniHost mantém um cache local dos recursos do Coolify. Quando você sincroniza:

- Recursos que aparecem na API viram `ACTIVE`.
- Recursos que não aparecem uma vez viram `MISSING`.
- Recursos que já estavam `MISSING` e não aparecem novamente viram `REMOVED`.
- Registros `REMOVED` não são apagados do MiniHost; ficam preservados para histórico e auditoria.

Status local:

| Status | Significado |
|--------|-------------|
| `ACTIVE` | Veio na última sincronização do Coolify. |
| `MISSING` | Não veio na última sincronização; pode ser falha temporária ou recurso apagado. |
| `REMOVED` | Não veio novamente e provavelmente foi removido diretamente no Coolify. |
| `ERROR` | Reservado para erro local de sincronização/cache. |

Na página **Coolify**, o filtro padrão mostra apenas **Ativos**. Use os filtros **Ausentes**, **Removidos** ou **Todos** para consultar histórico local de recursos que não existem mais no Coolify.

### Vincular projeto MiniHost ao Coolify

1. Sincronize recursos na página **Coolify**.
2. Abra um projeto MiniHost em **Projetos**.
3. Na seção **Projeto Coolify deste projeto**, selecione o projeto Coolify sincronizado.
4. Clique em **Vincular projeto Coolify**.

Esse vínculo é apenas organizacional nesta etapa. Ele não executa deploy nem modifica o Coolify.

Se o recurso vinculado virar `MISSING` ou `REMOVED`, o MiniHost mantém o vínculo local e mostra alerta no projeto. Use **Remover vínculo local** para limpar apenas a associação no MiniHost, sem alterar nada no Coolify.

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

Na listagem de projetos ou na **Zona de perigo** do detalhe do projeto, use **Arquivar projeto**. O projeto muda para status `ARCHIVED` e recebe `archivedAt`, mas os registros DNS, aplicações Coolify, projeto Coolify e bancos PostgreSQL vinculados **não são excluídos**.

Arquivar é uma ação **local e segura** — ideal para ocultar projetos inativos sem derrubar infraestrutura.

### Encerrar projeto e infraestrutura (Etapa 16)

Na tela de detalhes do projeto (`/projects/[id]`), role até a **Zona de perigo** no final da página.

#### Diferença entre Arquivar e Encerrar

| Ação | O que faz | DNS Cloudflare | Apps Coolify | Projeto Coolify | Bancos PostgreSQL |
|------|-----------|----------------|--------------|-----------------|-------------------|
| **Arquivar** | Marca `ARCHIVED` localmente | Mantém | Mantém | Mantém | Mantém |
| **Encerrar** | Remove recursos reais (conforme opções) | Pode remover | Pode remover | Pode remover | **Preservados por padrão** |

#### Confirmação forte

Encerrar exige digitar exatamente `encerrar {slug-do-projeto}` (ex.: `encerrar portfolio`) e marcar que você entende os riscos.

#### O que é removido no encerramento (padrões)

Por padrão, o modal marca:

- Arquivar projeto no MiniHost
- Excluir DNS Cloudflare vinculados
- Excluir aplicações no Coolify
- Excluir projeto Coolify (via `ProjectCoolifyLink`; se foi criado pelo MiniHost)
- **Não** desprovisionar bancos PostgreSQL

#### Por que bancos não são removidos por padrão

Destruir banco é irreversível. Use o fluxo próprio de desprovisionamento na seção de bancos do projeto, ou marque explicitamente a opção no modal de encerramento.

#### Falha parcial e pendências

Se parte do encerramento falhar (ex.: DNS removido, mas projeto Coolify não), o status fica `TERMINATED_WITH_ERRORS` e as pendências aparecem na Zona de perigo com o erro de cada recurso.

Use **Tentar novamente pendências** para repetir apenas os itens que falharam (com nova confirmação).

#### Proteções de segurança

Não é permitido encerrar:

- Projeto com slug `minihost`
- Banco ou usuário `postgres` / `minihost`
- Domínio principal **igual ao domínio raiz** do painel (ex.: `meudominio.com`, não `app.meudominio.com`)
- Registro DNS apex (`@`) do domínio raiz do painel
- Aplicação identificada como MiniHost

#### AuditLog

O encerramento registra eventos `PROJECT_TERMINATE_*` sem tokens, senhas ou envs sensíveis.

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

1. Suportar repositórios privados no Coolify (GitHub App e Deploy Key).
2. Configurar variáveis de ambiente no Coolify após a criação da aplicação.
3. Implementar ações controladas no Coolify (stop, restart, deploy manual) com confirmação forte.
4. Criar templates de deploy por tipo de aplicação.
5. Melhorar comparação antes/depois da sincronização DNS.
6. Backup e restauração de bancos PostgreSQL por projeto.

## Observação

O MiniHost já provisiona e desprovisiona bancos PostgreSQL reais (com confirmação forte), sincroniza e edita DNS na Cloudflare, sincroniza recursos Coolify, cria aplicações reais no Coolify a partir de repositórios públicos (com confirmação forte), planeja aplicações por projeto e mantém histórico/auditoria no PostgreSQL. Repositórios privados, envs automáticas no Coolify e ações destrutivas ainda não foram implementados.
