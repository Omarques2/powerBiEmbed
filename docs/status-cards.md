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
- [ ] Milestone 5: Auth + Pending + Callback + modais globais
- [ ] Milestone 6: Power BI embeds e previews
- [ ] Milestone 7: QA final (lint/test/build + regressao visual)
- [ ] Milestone 8: Ajustes finais de UX/branding (HomeView + cards + skeletons + loading + 404)

## EPIC-06 - CI/CD GitHub Actions (DEVOPS)
- [x] P1 CI PR monorepo-aware (lint/type/test/build web+api + cache + paths-filter)
- [x] P1 CD main com gates explicitos + migrations/rollback

## EPIC-07 - Testes e qualidade (API/WEB)
- [x] P1 Healthcheck/Readiness (gate CD)
- [ ] P2 E2E isolado de DB real + alinhamento total
- [ ] P2 Vitest coverage WEB (UI base Shadcn + Shell mobile)
- [ ] P2 Battery de testes negativos e fuzzing leve (API)

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
- [x] P1 Exportacao PDF com whitelist no backend

## EPIC-13 - Reestrutura do painel Admin focado em Customer (WEB + API)
- [x] P1 Modal de Customer com abas (Resumo/Relatorios/Permissoes de paginas)
- [x] P1 Tree view de workspaces + reports com toggles imediatos
- [x] P1 Permissoes de paginas no modal (grupos + preview multi-pagina)
- [x] P1 Reestrutura da aba Users (Pendentes/Usuarios/Admins unificados)
