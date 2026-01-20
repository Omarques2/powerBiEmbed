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
- [ ] P1 CamelCase TS + @map/@@map + reset unico

## EPIC-04 - Mobile-first 100% + responsividade (WEB)
- [ ] P0 Corrigir overflow Shell (mobile)
- [ ] P1 Padrao Drawer/Menu mobile (dep BaseDrawer)
- [ ] P1 Tabelas Admin responsivas (dep BaseTable)

## EPIC-05 - Base UI + Tailwind governance (WEB)
- [ ] P1 Base UI responsiva + tokens Tailwind

## EPIC-06 - CI/CD GitHub Actions (DEVOPS)
- [x] P1 CI PR monorepo-aware (lint/type/test/build web+api + cache + paths-filter)
- [~] P1 CD main com gates explicitos + migrations/rollback
  - Feito: workflow `cd-main.yml`, Dockerfile da API, doc `docs/cd-azure.md`.
  - Falta: configuracao Azure (Container Apps + Static Web Apps), secrets do GitHub, bases/staging.

## EPIC-07 - Testes e qualidade (API/WEB)
- [x] P1 Healthcheck/Readiness (gate CD)
- [ ] P2 E2E isolado de DB real + alinhamento total
- [ ] P2 Vitest coverage WEB (Base UI + Shell mobile)

## EPIC-08 - Modularizacao Admin + performance (API)
- [ ] P2 Modularizar AdminUsersService por dominio

## EPIC-09 - Rebuild do front-end com Shadcn (WEB)
- [ ] P2 Refazer UI com componentes Shadcn

---

## Kanban (alto nivel)

### Backlog
- EPIC-03 P1 Casing TS/DB + Prisma mapping + migracoes/reset
- EPIC-04 P0/P1 Mobile-first + Drawer/Menu + Tabelas responsivas
- EPIC-05 P1 Base UI + tokens Tailwind
- EPIC-07 P2 E2E isolado de DB real + alinhamento total
- EPIC-07 P2 Vitest coverage WEB (Base UI + Shell mobile)
- EPIC-08 P2 Modularizacao AdminUsersService
- EPIC-09 P2 Rebuild do front-end com Shadcn

### Em andamento
- EPIC-06 P1 CD main (infra Azure + secrets + deploy)

### Feito
- EPIC-01 P0/P1 Hardening completo
- EPIC-02 P0/P1 Contratos + env schema
- EPIC-06 P1 CI PR monorepo-aware
- EPIC-07 P1 Healthcheck/Readiness
