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
- [ ] P1 Padrao Drawer/Menu mobile (dep BaseDrawer)
- [ ] P1 Tabelas Admin responsivas (dep BaseTable)

## EPIC-05 - Rebuild do front-end com Shadcn (WEB)
- [ ] P2 Refazer UI com componentes Shadcn

## EPIC-06 - CI/CD GitHub Actions (DEVOPS)
- [x] P1 CI PR monorepo-aware (lint/type/test/build web+api + cache + paths-filter)
- [x] P1 CD main com gates explicitos + migrations/rollback

## EPIC-07 - Testes e qualidade (API/WEB)
- [x] P1 Healthcheck/Readiness (gate CD)
- [ ] P2 E2E isolado de DB real + alinhamento total
- [ ] P2 Vitest coverage WEB (UI base Shadcn + Shell mobile)
- [ ] P2 Battery de testes negativos e fuzzing leve (API)

## EPIC-08 - Modularizacao Admin + performance (API)
- [ ] P2 Modularizar AdminUsersService por dominio

## EPIC-10 - Controle granular de reports + RLS reutilizavel (API/WEB)
- [ ] P1 Acesso por report (nao apenas por workspace)
- [x] P1 RLS reutilizavel (targets/regras por dataset)
  - Opcao 3 dataset-first implementada (sem vinculos).
  - Nota operacional: RLS embed confirmado com todas as fontes em Import (Postgres + Lakehouse).

## EPIC-11 - Documentacao e onboarding (PBIX)
- [x] P1 Atualizar Guia PBIX (nomes de tabelas)
- [x] P1 Simplificar etapas iniciais do guia PBIX (tabelas prontas)
