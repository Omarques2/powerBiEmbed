# PBI-EMBED - Planejamento (Backlog Revisado)

## Sumario executivo
- P0 mantem nucleo de risco: TLS DB valido, hardening do bootstrap (ValidationPipe/Helmet/rate limit/CORS) e contrato DTO + envelope, alem do overflow mobile do Shell.
- P1 reforca operacao: healthcheck/readiness como gate de CD, AuthZ audit (guards), secrets hygiene, config/env validation, base UI responsiva e padroes de drawer/table.
- Casing/migracao/reset permanece P1, com criterio explicito para promocao antecipada (se endpoints retornam snake_case, priorizar antes do typing final do web).
- Contrato/envelope inclui shape final de meta (paginacoes), codigos de erro e correlationId.
- Observabilidade minima integrada: logs estruturados por request com correlationId, metodo, path, status e latency; sem logar body por padrao.
- Hardening considera CSP opcional (Power BI) e rate limit com escopo calibrado.
- CI antes de CD com monorepo-aware caching/path filters.
- CD com gates explicitos: CI verde + /health + db:migrate:deploy validado em staging.
- Mobile-first com dependencias explicitas: Drawer/Menu depende de BaseDrawer; tabelas dependem de BaseTable.
- Testes e modularizacao ficam para P2 apos contratos estaveis.

## Epicos e cards

### EPIC-01: Hardening de producao (API)
Card P0 — API | TLS DB SSL validation + env flags  
Contexto: Prisma conecta com TLS sem validacao.  
Objetivo: TLS valido por padrao em prod/staging; relaxado apenas em dev via env validada.  
Arquivos/areas: prisma.service.ts, .env.example, docs de env.  
Estrategia:
- rejectUnauthorized: true por padrao.
- Flag DB_SSL_ALLOW_INVALID=true apenas para dev; validar por schema.
- Documentar comportamento por ambiente.
Aceite:
- Em prod: cert invalido falha; cert valido conecta.
- Em dev com flag: conecta com self-signed.
- Nenhum segredo no log.
Testes:
- Manual: NODE_ENV=production sem flag -> cert invalido falha, valido ok.
- Automatizado: unit da factory do Pool; opcional e2e TLS.
Dependencias: Config schema (EPIC-02).

Card P0 — API | Hardening bootstrap (ValidationPipe + Helmet + rate limit + CORS env)  
Contexto: bootstrap sem guardrails; CORS fixo localhost; Helmet/rate limit ausentes.  
Objetivo: defaults seguros e calibrados.  
Arquivos/areas: main.ts, config.  
Estrategia:
- ValidationPipe global (whitelist, forbidNonWhitelisted, transform).
- Helmet com CSP opcional (ENABLE_CSP + allowlist Power BI).
- Rate limit escopado (/admin, /auth) por env; avaliar trust proxy.
- CORS via CORS_ORIGINS (csv) + CORS_CREDENTIALS.
Aceite:
- Campo extra -> 400.
- Headers de seguranca presentes; CSP opcional nao quebra embed.
- Origin fora da lista -> bloqueado.
- Rate limit -> 429 no escopo.
Testes:
- Manual: Origin invalido; POST com campo extra; flood /admin -> 429.
- Automatizado: e2e 400/429/CORS; unit config parsing.
Dependencias: Config schema (EPIC-02).

Card P1 — API | AuthZ audit + cobertura de guards  
Objetivo: garantir AuthGuard + ActiveUser/PlatformAdmin em rotas sensiveis e documentar matriz rota->guard.  
Estrategia: mapear rotas; adicionar guard faltante; documentar matriz; testes 401/403.  
Aceite: /admin/rls/powerbi -> 401 sem token e 403 sem papel.  
Dependencias: DTO/envelope (EPIC-02).

Card P1 — API | Secrets hygiene (.env, .env.example, logs)  
Objetivo: padronizar envs e evitar exposicao de secrets.  
Estrategia: .env.example completo; revisar logs para evitar printing de env/body.  
Dependencias: Config schema (EPIC-02).

### EPIC-02: Contratos, validacao e erros padronizados (API)
Card P0 — API | DTOs + envelope + erros padronizados + observabilidade minima  
Objetivo: DTOs com class-validator; envelope { data, meta?, error? } com meta padronizado; correlationId em todas respostas.  
Estrategia:
- DTO por endpoint; ValidationPipe global.
- Interceptor de envelope + correlationId.
- ExceptionFilter com mapeamento Prisma P2002->409 UNIQUE_CONSTRAINT, P2025->404 NOT_FOUND.
- Fallback 500 inclui correlationId; stack so em dev.
- Logging por request: correlationId, method, path, status, latency.
Aceite:
- Sucesso: { data: ... }; paginacao: { data, meta:{page,pageSize,total} }.
- Erros: { error:{ code,message,details? }, correlationId }.
- UNIQUE_CONSTRAINT 409; VALIDATION_ERROR 400.
Testes:
- Manual: payload invalido -> 400 VALIDATION_ERROR; duplicar -> 409; correlationId em resposta/log.
- Automatizado: unit do interceptor/filter; e2e 400/409/404.

Card P1 — API | Validacao de env (ConfigModule schema)  
Objetivo: fail-fast com mensagens claras e defaults seguros.  
Estrategia: schema zod/joi incluindo CORS/CSP/RATE_LIMIT/DB_SSL_ALLOW_INVALID/ENTRA/PBI.  
Aceite: app nao inicia sem vars obrigatorias.

### EPIC-03: Casing TS/DB + Prisma mapping + migracoes/reset (API/DB)
Card P1 — API/DB | CamelCase TS + @map/@@map + reset unico  
Objetivo: TS/HTTP camelCase; DB snake_case via @map/@@map; scripts db.  
Criterio promocao: se endpoints admin retornam snake_case, priorizar antes do typing final do web.  
Dependencias: EPIC-02 envelope.

### EPIC-04: Mobile-first 100% + responsividade (WEB)
Card P0 - WEB | Corrigir overflow da topbar do Shell (mobile)  
Objetivo: sem overflow em 390px; touch targets >=44px; desktop ok.

Card P0 - WEB | Ajustes UX de navegacao (loading + topbar + sidebar)  
Contexto: feedback visual inconsistente e comportamento do sidebar confuso.  
Objetivo: feedback de loading ao navegar entre Home e Admin, topbar mostrando aba ativa, sidebar nao colapsa antes da selecao de relatorio.  
Escopo: WEB (Home, Admin, Shell).  
Aceite:
- Clique em "Admin" (Home) aciona loading imediato.
- Clique em "App" (Admin) aciona loading imediato.
- Topbar exibe "Admin / <Aba>" corretamente.
- Sidebar so colapsa apos selecionar relatorio.

Card P1 - WEB | Padrao Drawer/Menu mobile (dep EPIC-05 Shadcn)  
Objetivo: Drawer padronizado reutilizavel (esc/overlay/focus).

Card P1 — WEB | Tabelas Admin responsivas (dep BaseTable)  
Objetivo: 390px sem corte; 768/1024 legivel.

### EPIC-05: Rebuild do front-end com Shadcn (WEB)
Card P2 - WEB | Fundacao Shadcn + tokens + infra (Tailwind v4)  
Contexto: hoje a UI usa classes utilitarias diretas e componentes customizados, sem biblioteca padronizada.  
Objetivo: criar base de design system Shadcn-like com tokens semanticos e infra consistente.  
Escopo: WEB (assets/main.css, estrutura de componentes, utilitarios).  
Estrategia:
- Definir tokens semanticos (background/foreground/primary/muted/accent/border/ring/radius).
- Aplicar padrao Tailwind v4 com `@theme inline` e `tw-animate-css`.
- Criar `cn()` utilitario e convencao de variants (CVA).
- Definir pasta de componentes (ex: `src/components/ui` ou `src/ui/shadcn`) e naming.
- Escolher stack de primitives (Radix Vue ou shadcn-vue) para Dialog/Select/Dropdown/Tabs.
Aceite:
- Tokens definidos e usados em pelo menos 2 componentes base.
- Build e preview ok com dark/light.
Dependencias: EPIC-06 CD main concluido; EPIC-04 estabilizado.

Card P2 - WEB | Biblioteca de componentes base (Shadcn)  
Objetivo: criar componentes reutilizaveis com acessibilidade e variantes.  
Escopo: WEB (UI base + wrappers).  
Estrategia:
- Button, Badge, Input, Textarea, Label, Select, Checkbox, Switch.
- Card, Table, Tabs, Tooltip, Dropdown, Dialog/Sheet, Toast, Skeleton.
- Mapear componentes atuais (`BaseDrawer`, toggles, toasts) para os novos.
Aceite:
- Componentes base com variantes documentadas e usados nas telas admin.

Card P2 - WEB | Layout e navegacao (Shell/Admin/Sidebar/Topbar)  
Objetivo: padronizar layout principal com novos componentes e spacing tokens.  
Escopo: ShellView, AdminView, SidebarContent, AdminTopBar, AdminSidebar.  
Estrategia:
- Refatorar header, buttons, tabs e menu lateral.
- Garantir responsivo e estados de loading coerentes.  
Aceite:
- Navegacao principal sem regressao e com consistencia visual.

Card P2 - WEB | Migracao das telas Admin (Customers/Users/Rls/Overview/Security)  
Objetivo: atualizar telas de maior uso para Shadcn mantendo fluxos atuais.  
Escopo: CustomersPanel, UsersPanel, RlsPanel, OverviewPanel, SecurityPlatformAdminsPanel.  
Estrategia:
- Migrar por tela, mantendo modais e trees.
- Consolidar estilos repetidos em componentes base.
Aceite:
- Paridade funcional e visual consistente entre telas.

Card P2 - WEB | Auth + Pending + Modais globais  
Objetivo: padronizar fluxos de login, callback e pending com a nova UI.  
Escopo: LoginView, PendingView, CallbackView e modais globais.  
Estrategia:
- Aplicar componentes base e tokens de tipografia.
- Padronizar mensagens de erro e estados vazios.  
Aceite:
- Fluxo de login/pending sem regressao e com layout consistente.

Card P2 - WEB | Power BI embeds e previews  
Objetivo: refatorar wrappers de embed para consistencia e acessibilidade.  
Escopo: previews de customer/usuario, menu de paginas, export.  
Estrategia:
- Padronizar container, skeleton, empty state e menu de paginas.
- Aplicar componentes base para tabs e cards.  
Aceite:
- Preview e embed com UI consistente, sem cortes e sem regressao.

Card P2 - WEB | QA, acessibilidade e regressao visual  
Objetivo: garantir qualidade e evitar regressao de UX.  
Escopo: testes e checklist visual.  
Estrategia:
- Ajustar testes vitest e snapshots criticos.
- Checklist por tela (desktop 1280, tablet 768, mobile 390).  
Aceite:
- Build, lint e testes ok; sem regressao visual detectada.

### EPIC-06: CI/CD GitHub Actions (DEVOPS)
Card P1 — DEVOPS | CI PR monorepo-aware (web+api)  
Objetivo: PR gates com lint/type/test/build por app; cache + path filters.

Card P1 — DEVOPS | CD main com gates explicitos  
Objetivo: deploy automatizado (Azure Container Apps + Static Web Apps), com gates de CI, /health e migrate deploy em staging.

### EPIC-07: Testes e qualidade (API/WEB)
Card P1 - API | Healthcheck/Readiness (gate CD)  
Objetivo: /health (liveness) e /ready (DB check).

Card P2 - API | E2E isolado de DB real + alinhamento total  
Objetivo: e2e usando DB de teste (TEST_DATABASE_URL) + migrate reset.

Card P2 - API | Battery de testes negativos e fuzzing leve  
Objetivo: validar rejeicao de inputs invalidos (tamanho, tipos, caracteres estranhos, SQLi basico) e erro coerente no envelope.  
Escopo: API (controllers e DTOs criticos).  
Estrategia:
- casos de payload invalido por endpoint (tipos, overflow, strings maliciosas).
- asserts de status + error.code + correlationId.
Aceite:
- 100% dos endpoints criticos com casos negativos cobrindo validacao.
- Nenhum crash 5xx em inputs invalidos.

Card P2 - WEB | Vitest coverage UI base (Shadcn) + Shell mobile  
Objetivo: cobertura da UI base (Shadcn) e menu mobile.

### EPIC-08: Modularizacao Admin + performance (API)
Card P2 — API | Modularizar AdminUsersService por dominio  
Objetivo: separar por dominios (customers, memberships, audit, security, perms).

Card P2 — API | Repositorio Prisma por dominio  
Contexto: services acessam Prisma direto, dificultando testes e isolamento.  
Objetivo: criar camada de repositorio por dominio (customers, users, powerbi, rls).  
Escopo: API (services + repositorios).  
Estrategia:
- Criar interfaces e implementacoes Prisma para cada dominio.
- Injectar repositorios nos services.
- Centralizar queries complexas e reduzir duplicacao.
Aceite:
- Services nao acessam Prisma diretamente.
- Testes unitarios usam repositorios mockados.

Card P2 — API | Reduzir acoplamento entre dominios  
Contexto: orquestracao direta entre services dificulta manutencao.  
Objetivo: usar eventos internos quando fizer sentido (ex: user/permissions/audit).  
Escopo: API.  
Estrategia:
- Introduzir eventos internos leves para acoes transversais.
- Evitar chamadas diretas entre dominios quando possivel.
Aceite:
- Fluxos transversais removem dependencias diretas.

### EPIC-10: Controle de acesso granular por report e RLS reutilizavel (API/WEB)
Card P1 - API/WEB | Acesso por report (nao apenas por workspace)  
Contexto: hoje o acesso e dado pela workspace inteira; clientes precisam limitar reports especificos.  
Objetivo: permitir selecionar quais reports um customer pode acessar, refletindo no acesso de usuarios vinculados.  
Escopo: API (permissoes), WEB (UI de configuracao).  
Estrategia:
- Modelo de permissao por report (permitir/negado por customer).
- UI para marcar reports por customer (lista por workspace).
- Ajustar resolucao de acesso no Power BI (usuarios herdam do customer).
 - Evolucao UX (Opcao 3): fluxo dataset-first (Dataset -> Targets -> Regras).
Aceite:
- Customer pode ter acesso parcial aos reports de uma workspace.
- Usuarios do customer herdam somente os reports marcados.
Status atual: concluido.

Card P1 - API/WEB | RLS reutilizavel (target/rule global + vinculo)  
Contexto: hoje regras precisam ser recriadas por customer mesmo para o mesmo dataset/report.  
Objetivo: criar targets/rules reutilizaveis, vinculados a workspace/report e aplicaveis por customer/usuario.  
Escopo: API (modelagem + endpoints), WEB (UI de associacao).  
Estrategia:
- Targets e regras estritamente por dataset (sem vinculos).
- Permitir aplicar regras por customer e opcionalmente por usuario.
- Gerar Sec_<target_key> automaticamente no backend (view pronta para importar no Power BI).
 - Evolucao UX (Opcao 3): Dataset -> Targets -> Regras.
Aceite:
- Regras reutilizaveis por dataset (customer e opcionalmente por usuario).
- Sec_<target_key> criado automaticamente no backend.
Nota operacional:
- Embed com RLS exige effective identity; se houver multiplas fontes, todas devem estar em Import e suportar effective identity.
 - Status atual: RLS validado com Postgres e Lakehouse em Import; DirectQuery/PowerQuery nao suportou effective identity no embed.
Status atual: concluido.

### EPIC-11: Documentacao e onboarding (PBIX)
Card P1 - DOC | Atualizar Guia PBIX (nomes de tabelas)  
Contexto: nomes das tabelas mudaram apos ajustes de schema.  
Objetivo: alinhar o tutorial PBIX aos nomes reais no modelo.  
Escopo: docs/tutorial PBIX.  
Aceite:
- Passos atualizados com nomes corretos.
- Sem divergencias entre guia e schema atual.

Card P1 - DOC | Simplificar etapas iniciais do guia PBIX (tabelas prontas)  
Contexto: as 3 primeiras etapas do guia podem ser puladas se entregarmos tabelas filtradas com os nomes finais.  
Objetivo: reduzir trabalho manual no Power BI, padronizando entrada com tabelas ja filtradas e nomeadas.  
Escopo: docs/tutorial PBIX + definicao de fontes/tabelas.  
Estrategia:
- Definir para cada regra uma tabela filtrada com nome final esperado pelo guia.
- Atualizar guia para pular etapas 1-3 quando essas tabelas estiverem disponiveis.
Aceite:
- Guia mostra caminho alternativo sem as 3 etapas iniciais.
- Tabelas filtradas e nomeadas de acordo com o passo 3 do guia.
Referencia:
- `docs/pbix-guide.md`
Status atual: concluido.

### EPIC-12: Permissoes de Abas (Pages) + Exportacao PDF por pagina (API/WEB)
Card P1 - API/WEB | Sincronizar paginas dos reports  
Contexto: hoje nao existe fonte de verdade de paginas por report.  
Objetivo: listar paginas via API do Power BI e salvar no banco.  
Escopo: API (job/endpoint admin) + DB (tabela de paginas).  
Estrategia:
- Endpoint/admin job "Sincronizar paginas" por report/workspace.
- Persistir pageName + displayName + reportRefId.
Aceite:
- Paginas sincronizadas e reutilizaveis no admin.

Card P1 - WEB | Grupos de permissoes por report (paginas)  
Contexto: admins precisam definir conjuntos reutilizaveis de paginas.  
Objetivo: criar grupos (ex: A.1/A.2/A.3) com lista de paginas.  
Escopo: WEB (UI) + API (CRUD grupos).  
Estrategia:
- UI com lista de paginas (toggle) e salvamento do grupo.
- Preview por pagina com embed e `pageName` (page nav oculto).
Aceite:
- Grupo salvo e reutilizavel em clientes/usuarios.
- Preview abre pagina correta sem navegação nativa.

Card P1 - WEB/API | Vincular grupos/paginas a customers e usuarios  
Contexto: acesso deve ser por customer/usuario, com excecoes ad hoc.  
Objetivo: permitir vincular 1+ grupos e paginas isoladas.  
Escopo: WEB + API.  
Estrategia:
- UI de vinculo por customer/usuario.
- Backend resolve whitelist final (grupos + ad hoc).
Aceite:
- Permissoes por pagina aplicadas para customer/usuario.

Card P1 - API/WEB | Embed com navegacao controlada pelo app  
Contexto: tabs nativas permitem acesso indevido.  
Objetivo: esconder pageNavigation e navegar via menu custom.  
Escopo: WEB + API (whitelist).  
Estrategia:
- `settings.panes.pageNavigation.visible = false`.
- Menu proprio no frontend; `page.setActive()`.
- Opcional: interceptar `pageChanged` e reverter se nao permitido.
Aceite:
- Usuario ve apenas paginas permitidas.

Card P1 - API | Exportacao PDF com whitelist no backend  
Contexto: export precisa respeitar permissao por pagina.  
Objetivo: exportar apenas paginas permitidas com Effective Identity.  
Escopo: API (export job) + UI (gatilho).  
Estrategia:
- Backend resolve paginas permitidas por customer/usuario.
- Usar `powerBIReportConfiguration.pages` no ExportToFile.
- Frontend pode pedir "pagina atual" ou "todas permitidas".
Aceite:
- PDF inclui somente paginas permitidas.

### EPIC-13: Reestrutura do painel Admin focado em Customer (WEB + API)
Card P1 - WEB | Modal de Customer com abas e UX simplificado  
Contexto: a tela atual e confusa; Power BI Ops precisa ser incorporado no fluxo do customer.  
Objetivo: centralizar tudo do customer em um modal com abas, eliminando a aba Power BI Ops.  
Escopo: WEB (Admin/Customers + Power BI Ops embutido).  
Estrategia:
- Modal de Novo/Editar Customer com abas: "Resumo", "Relatorios", "Permissoes de paginas".
- Somente "Resumo" visivel no primeiro save (code + name); abas liberadas apos salvar.
- Aba "Relatorios": tree view de workspaces + reports com toggles imediatos (persistencia no BD).
- Aba "Permissoes de paginas": seletor de report, lista de paginas (toggle + selecao), grupos e preview multi-pagina.
- Ao ativar grupo para customer: limpar allowlist individual e tornar toggles read-only (back-end bloqueia alteracoes individuais).
Aceite:
- Power BI Ops removido do menu; tudo acessivel pelo modal de customer.
- Toggle de workspace/report aplica no BD sem botao de salvar.
- Paginas individuais ficam read-only quando ha grupo ativo e refletem o acesso efetivo.
Notas:
- Permissoes do customer devem refletir nos usuarios, mas a tela de usuarios sera tratada em card separado.

### EPIC-14: Componentizacao Vue e manutenibilidade (WEB)
Card P2 — WEB | Quebrar telas grandes em componentes menores  
Contexto: telas longas dificultam manutencao e testes (ex: Customers/Users/Rls).  
Objetivo: dividir em componentes claros e reutilizaveis.  
Escopo: WEB (features/admin).  
Estrategia:
- Extrair subcomponentes por secao (tabs, listas, previews, modais).
- Definir props tipadas e eventos claros.
Aceite:
- Componentes com responsabilidade unica.
- Reducao de tamanho/complexidade nas telas principais.

Card P2 — WEB | Extrair componentes de UI reutilizaveis  
Contexto: padroes repetidos (cards/listas/toggles/modais).  
Objetivo: criar componentes base reutilizaveis.  
Escopo: WEB (src/ui).  
Estrategia:
- Criar componentes base com props tipadas.
- Documentar uso em telas admin.
Aceite:
- Menos duplicacao de markup e estilos.

## Mini-roteiro (Opcao 3 + EPIC-11)
1. UX dataset-first (WEB):
   - Novo fluxo: Dataset -> Targets -> Regras.
   - Targets e regras por dataset, sem dependencia de customer/workspace/report.
   - Regras com escopo (customer/usuario) e filtros rapidos.
2. API/DB:
   - Manter schema atual; ajustar endpoints para dataset-first.
   - Criar Sec_<target_key> automaticamente no backend.
3. Guia PBIX (EPIC-11):
    - Atualizar nomes e DAX (CUSTOMDATA + USERNAME).
    - Guia usa Sec_<target_key> direto no Postgres (sem sec_rls_base).
4. Testes:
   - E2E: criar target -> regra customer/usuario -> snapshot.
   - Manual: fluxo completo na UI + export do snapshot.


## Roadmap por fases
Fase 1: EPIC-01 P0 (TLS + hardening bootstrap) + EPIC-02 P0 (DTO/envelope/logs).  
Fase 2: EPIC-02 P1 env schema + EPIC-07 P1 healthcheck.  
Fase 3: EPIC-03 P1 casing/migracao/reset (promover se snake_case dominar).  
Fase 4: EPIC-04 P0 mobile-first core + EPIC-05 Shadcn (se ja iniciado).  
Fase 5: EPIC-06 P1 CI PR -> CD main P1 (gates: CI verde + /health + migrate deploy).  
Fase 6: EPIC-07 P2 testes (isolamento + bateria negativa); EPIC-08 P2 modularizacao.  
Fase 7: EPIC-05 refactor completo do front-end com Shadcn (pos-producao).

## Checklist de readiness de producao
- TLS DB valido; flag dev documentada.
- Env schema valida tudo; .env.example completo; secrets nao logados.
- CORS por lista; Helmet ativo (CSP opcional); rate limit calibrado; trust proxy verificado.
- ValidationPipe global; DTOs; envelope { data, meta?, error{code,message,details?} }.
- CorrelationId em responses e logs; logs com method/path/status/latency; sem body por padrao.
- Prisma camelCase com @map/@@map; scripts db:reset, db:migrate:deploy, db:seed:test.
- Healthcheck /health e readiness /ready disponiveis e usados em CD.
- CI PR verde; CD main automatizado com migrations e rollback.
- UI mobile-first validada em 390/768/1280; drawer/menu padrao; tabelas/modais responsivos.

## Referencia de CD (Azure)
Para configuracao e manutencao de CD, veja `docs/cd-azure.md`.
