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
Card P0 — WEB | Corrigir overflow da topbar do Shell (mobile)  
Objetivo: sem overflow em 390px; touch targets >=44px; desktop ok.

Card P1 — WEB | Padrao Drawer/Menu mobile (dep BaseDrawer)  
Objetivo: Drawer padronizado reutilizavel (esc/overlay/focus).

Card P1 — WEB | Tabelas Admin responsivas (dep BaseTable)  
Objetivo: 390px sem corte; 768/1024 legivel.

### EPIC-05: Base UI + Tailwind governance (WEB)
Card P1 — WEB | Base UI responsiva + tokens Tailwind  
Objetivo: Button/Card/Modal/Drawer/Table; tokens de radius/shadow/spacing.

### EPIC-06: CI/CD GitHub Actions (DEVOPS)
Card P1 — DEVOPS | CI PR monorepo-aware (web+api)  
Objetivo: PR gates com lint/type/test/build por app; cache + path filters.

Card P1 — DEVOPS | CD main com gates explicitos  
Objetivo: deploy automatizado (Azure Container Apps + Static Web Apps), com gates de CI, /health e migrate deploy em staging.

### EPIC-07: Testes e qualidade (API/WEB)
Card P1 — API | Healthcheck/Readiness (gate CD)  
Objetivo: /health (liveness) e /ready (DB check).

Card P2 — API | E2E isolado de DB real + alinhamento total  
Objetivo: e2e usando DB de teste (TEST_DATABASE_URL) + migrate reset.

Card P2 — WEB | Vitest coverage Base UI + Shell mobile  
Objetivo: cobertura de Base UI e menu mobile.

### EPIC-08: Modularizacao Admin + performance (API)
Card P2 — API | Modularizar AdminUsersService por dominio  
Objetivo: separar por dominios (customers, memberships, audit, security, perms).

## Roadmap por fases
Fase 1: EPIC-01 P0 (TLS + hardening bootstrap) + EPIC-02 P0 (DTO/envelope/logs).  
Fase 2: EPIC-02 P1 env schema + EPIC-07 P1 healthcheck.  
Fase 3: EPIC-03 P1 casing/migracao/reset (promover se snake_case dominar).  
Fase 4: EPIC-04 P0 mobile-first core + EPIC-05 Base UI.  
Fase 5: EPIC-06 P1 CI PR -> CD main P1 (gates: CI verde + /health + migrate deploy).  
Fase 6: EPIC-07 P2 testes; EPIC-08 P2 modularizacao.  
Fase 7: EPIC-09 refactor completo do front-end com Shadcn (pos-producao).

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

## EPIC-09: Rebuild do front-end com Shadcn (WEB)
Card P2 — WEB | Refazer UI com componentes Shadcn  
Contexto: desejo de padronizar UI e acelerar consistencia visual com biblioteca de componentes.  
Objetivo: migrar telas e UI base para Shadcn mantendo contratos e fluxos.  
Escopo: WEB (componentes, layout, estilos, composables, testes).  
Estrategia:
- Congelar design atual apos producao, evitar rework antes de CD.
- Criar baseline: config Shadcn, theme tokens e componentes base.
- Migrar por blocos (Shell, Admin, Panels), com QA visual por tela.
Critérios de aceite:
- Paridade funcional com UI atual.
- Sem regressao de acessibilidade e responsividade.
- Build e testes web ok.
Dependencias: EPIC-06 CD main concluido; EPIC-04/05 concluido ou incorporado na migracao.
