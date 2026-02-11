# PBI-EMBED - Status do Projeto (cards)

Legenda:
- [x] feito
- [~] parcial
- [ ] nao feito

## EPIC-01 - Hardening de producao (API)
- [x] P0 TLS DB SSL validation + env flags
- [x] P0 Hardening bootstrap (ValidationPipe + Helmet + rate limit + CORS env)
- [x] P1 AuthZ audit + cobertura de guards (matriz + e2e 401/403)
- [x] P1 Secrets hygiene (.env.example + docs)

## EPIC-02 - Contratos, validacao e erros padronizados (API)
- [x] P0 DTOs + envelope + erros padronizados + observabilidade minima
- [x] P0 Testes do contrato/envelope/erros (unit + e2e 400/409/404)
- [x] P1 Env schema validation (fail-fast)

## EPIC-03 - Casing TS/DB + Prisma mapping + migracoes/reset (API/DB)
- [x] P1 CamelCase TS + @map/@@map + reset unico

## EPIC-04 - Mobile-first 100% + responsividade (WEB)
- [x] P0 Corrigir overflow Shell (mobile)
- [x] P0 Ajustes UX de navegacao (loading + topbar + sidebar)
- [x] P0 Estabilidade mobile nos fluxos Admin (Customer/Users modais, tabs e listas)
- [x] P0 Preview da visao efetiva (Customer/Usuario)
- [x] P1 Padrao Drawer/Menu mobile (dep BaseDrawer)
- [x] P1 Tabelas Admin responsivas (dep BaseTable)

## EPIC-05 - Rebuild do front-end com Shadcn (WEB)
- [x] Stack definido (shadcn-vue + radix-vue + Tailwind v4 + tw-animate-css + lucide-vue-next + zod)
- [x] Estrategia de execucao (branch unica + milestones internos) registrada
- [x] Milestone 1: Infra + tokens (Tailwind v4 + @theme inline + cn/CVA)
- [x] Milestone 2: Componentes base (Button/Input/Select/Tabs/Dialog/Sheet/Toast/Skeleton/Card)
- [x] Milestone 3: Layout e shell (Home/Shell/Admin/Sidebar/Topbar)
- [x] Milestone 4: Admin core (Customers/Users/Rls/Overview/Security)
- [x] Milestone 5: Auth + Pending + Callback + modais globais
- [x] Milestone 6: Power BI embeds e previews
- [x] Milestone 7: QA final (lint/test/build + regressao visual)
- [x] Milestone 8: Ajustes finais de UX/branding (HomeView + cards mobile + memberships simplificado + 404)
- [~] P2 Cache persistente de listas (storage + refresh invisivel) — descopado (dados sempre do BD)

## EPIC-06 - CI/CD GitHub Actions (DEVOPS)
- [x] P1 CI PR monorepo-aware (lint/type/test/build web+api + cache + paths-filter)
- [x] P1 CD main com gates explicitos + migrations/rollback

## EPIC-07 - Testes e qualidade (API/WEB)
- [x] P1 Healthcheck/Readiness (gate CD)
- [x] P1 Validacao de ambientes (local -> staging -> prod + DB safety)
- [x] P2 E2E isolado de DB real + alinhamento total
- [x] P2 Test factories + fixtures (seed deterministico)
- [x] P2 Vitest coverage WEB (UI base Shadcn + Shell mobile)
- [x] P2 Battery de testes negativos e fuzzing leve (API)

## EPIC-08 - Modularizacao Admin + performance (API)
- [x] P2 Modularizar AdminUsersService por dominio
- [x] P2 Repositorio Prisma por dominio (camada de acesso a dados)
- [x] P2 Reduzir acoplamento entre dominios (eventos internos quando fizer sentido)

## EPIC-14 - Componentizacao Vue e manutenibilidade (WEB)
- [x] P2 Quebrar telas grandes (Customers/Users/Rls) em componentes menores
- [x] P2 Extrair componentes de UI reutilizaveis (listas, cards, modais, toggles)

## EPIC-10 - Controle granular de reports + RLS reutilizavel (API/WEB)
- [x] P1 Acesso por report (nao apenas por workspace)
- [x] P1 RLS reutilizavel (targets/regras por dataset)
  - Opcao 3 dataset-first implementada (sem vinculos).
  - Nota operacional: RLS embed confirmado com todas as fontes em Import (Postgres + Lakehouse).

## EPIC-11 - Documentacao e onboarding (PBIX)
- [x] P1 Atualizar Guia PBIX (nomes de tabelas)
- [x] P1 Simplificar etapas iniciais do guia PBIX (tabelas prontas)

## EPIC-12 - Permissoes de Abas (Pages) + Exportacao PDF (API/WEB)
- [x] P1 Sincronizar paginas dos reports (API/DB)
- [x] P1 Grupos de permissoes por report (UI + API)
- [x] P1 Vincular grupos/paginas a customers e usuarios
- [x] P1 Embed com navegacao controlada pelo app
- [x] P1 Fix: navegacao nao trava ao clicar em paginas antes do report carregar
- [x] P1 Acesso efetivo por interseccao (customer x usuario) + ordenacao por pageOrder
- [x] P1 Exportacao PDF com whitelist no backend
- [x] P1 Sync automatico de paginas (cron GH Actions + endpoint interno)

## EPIC-13 - Reestrutura do painel Admin focado em Customer (WEB + API)
- [x] P1 Modal de Customer com abas (Resumo/Relatorios/Permissoes de paginas)
- [x] P1 Tree view de workspaces + reports com toggles imediatos
- [x] P1 Permissoes de paginas no modal (grupos + preview multi-pagina)
- [x] P1 Reestrutura da aba Users (Pendentes/Usuarios/Admins unificados)
- [x] P1 Pre-cadastro de usuarios (email + membership + auto-link no 1º login)

## EPIC-15 - Hardening de Auth UX + resiliencia de sessao (WEB/API)
- [x] P0 Card 01 - Evitar logout agressivo em erro transitório de token
  Problema: a sessão pode cair por erro transitório (rede, timeout, corrida de requests), mesmo sem expiração real do login.
  Critérios de aceite:
  - Falhas transitórias de `acquireTokenSilent` usam retry/backoff e nao limpam sessão imediatamente.
  - Apenas `InteractionRequiredAuthError` dispara fluxo interativo.
  - Usuario nao é redirecionado para `/login` em falha transitória recuperável.

- [x] P0 Card 02 - Reset de auth não-destrutivo
  Problema: reset amplo de storage pode apagar dados de UX e causar sensação de travamento/reload total.
  Critérios de aceite:
  - Reset remove apenas estado de autenticação (MSAL e chaves correlatas), sem `localStorage.clear()` global.
  - IndexedDB é limpo somente para namespaces de auth.
  - Tema/preferencias/outros estados do app permanecem intactos após reset de auth.

- [x] P0 Card 03 - Boot não-bloqueante no startup
  Problema: inicialização síncrona de auth pode congelar a entrada da aplicação e piorar tempo de primeira tela.
  Critérios de aceite:
  - App monta sem aguardar init completa de auth.
  - Warm-up de auth roda em background com timeout controlado.
  - Em lentidão de IdP/rede, a UI segue responsiva.

- [x] P0 Card 04 - Mutex/serialização de aquisição de token
  Problema: requests concorrentes de token geram corrida, erros de interação e comportamentos inconsistentes.
  Critérios de aceite:
  - Aquisição de token é serializada por mutex/single-flight.
  - Requests paralelos reutilizam resultado em voo quando aplicável.
  - Nao ocorre explosão de chamadas simultâneas ao MSAL em navegação com múltiplos requests.

- [x] P1 Card 05 - Retry/backoff para `/users/me` e chamadas sensíveis
  Problema: falhas momentâneas de rede geram estado falso de pending/sessão expirada.
  Critérios de aceite:
  - `/users/me` usa retry com backoff e jitter para erros retryable.
  - Falha temporária preserva ultimo estado conhecido quando possível.
  - Apenas 401/403 invalidam identidade de forma imediata.

- [x] P1 Card 06 - Recuperação após background/suspensão de aba
  Problema: após longo tempo em segundo plano, browsers podem descartar contexto e quebrar chamadas de auth.
  Critérios de aceite:
  - Eventos `visibilitychange`, `focus`, `pageshow` e `online` disparam recuperação silenciosa.
  - Recuperação tem throttle para evitar tempestade de chamadas.
  - Usuario volta para aba com sessão funcional sem precisar refresh manual.

- [x] P1 Card 07 - Retry inteligente após 401 no HTTP client
  Problema: 401 transitório no backend força logout direto sem tentativa de refresh token.
  Critérios de aceite:
  - Interceptor tenta 1 retry com `forceRefresh` antes de resetar auth.
  - Requisição original é repetida uma vez com novo token.
  - Se retry falhar, fallback para reset + navegação para login permanece funcionando.

- [x] P1 Card 08 - Mensagens UX corretas em Pending/Callback
  Problema: erro transitório pode ser exibido como “sessão expirada”, confundindo usuário e suporte.
  Critérios de aceite:
  - Pending diferencia “sem autorização” de “instabilidade temporária”.
  - Callback trata falha de init sem loop de erro.
  - Mensagens orientam usuário sem instruir limpeza manual de cache.

- [x] P1 Card 09 - Compatibilidade de issuer no backend conforme host configurado
  Problema: validação de issuer fixa em `login.microsoftonline.com` pode rejeitar tokens válidos em hosts autorizados.
  Critérios de aceite:
  - Validação de issuer usa `ENTRA_AUTHORITY_HOST` configurado.
  - Tokens válidos no host configurado passam sem regressão de segurança.
  - Tokens com issuer fora do host permitido continuam sendo rejeitados.

- [x] P2 Card 10 - Política anti-stale para rotas de auth no Static Web App
  Problema: HTML stale em borda/cache pode exigir refresh manual e quebrar callback/login.
  Critérios de aceite:
  - Rotas de entrada SPA (`/`, `/login`, `/auth/callback`, `/pending`, `/app`, `/admin`) retornam `Cache-Control: no-store`.
  - Assets estáticos mantêm estratégia normal de cache via exclusões do fallback.
  - Fluxo de login/callback funciona após deploy sem ação manual do usuário.
