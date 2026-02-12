# Admin Access Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar um painel de métricas de acesso no Admin Panel com visão de logins por horário, usuários ativos recentemente, ranking de acessos por usuário e eventos recentes de autenticação.

**Architecture:** Reaproveitar `audit_log` para registrar eventos de autenticação (`AUTH_LOGIN_SUCCEEDED`) e expor um endpoint agregado para o Admin. O frontend adiciona uma aba/painel de métricas com cards + séries temporais (sem dependência externa de chart inicialmente, via componente SVG simples). A agregação roda no backend com filtros de janela/timezone e limites de consulta.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Vue 3 + TypeScript + Tailwind, Vitest (web), E2E existente (api).

---

### Task 1: Definir contrato funcional e semântica de métricas

**Files:**
- Modify: `docs/status-cards.md`
- Create: `docs/admin-access-metrics.md`

**Step 1: Documentar semântica das métricas (fonte de verdade)**

Definir no documento:
- O que conta como `login` (evento `AUTH_LOGIN_SUCCEEDED`).
- O que conta como `usuário ativo agora` (ex.: `lastLoginAt >= now - 15min`).
- Janela padrão de análise (ex.: `24h`) e janelas suportadas (`1h`, `6h`, `24h`, `7d`, `30d`).
- Timezone padrão (ex.: `America/Sao_Paulo`) e comportamento quando informado na query.

**Step 2: Criar cards no EPIC-15**

Adicionar cards com critérios de aceite para:
- Métricas de acesso no Admin.
- Série de logins por horário.
- Ranking de usuários por acessos.
- UX de loading/empty/error states do painel.

**Step 3: Revisar consistência com roadmap atual**

Garantir que os cards novos não conflitam com os cards de hardening já concluídos.

---

### Task 2: Preparar persistência para consultas de métricas em escala

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_audit_metrics_indexes/migration.sql`

**Step 1: Escrever teste de regressão de desempenho/consulta (E2E leve)**

Adicionar no E2E de admin uma chamada de métricas com período curto, validando tempo de resposta aceitável em dataset de teste e contrato de resposta.

**Step 2: Criar índice para consultas de login por tempo**

Adicionar índice composto em `audit_log` para consulta por ação + tempo:
- `@@index([action, createdAt], map: "idx_audit_action_created")`

**Step 3: Rodar migração e validar**

Executar migração local e validar que o Prisma Client compila sem drift.

---

### Task 3: Registrar evento de login com deduplicação temporal

**Files:**
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/common/http/request-context.ts` (somente se precisar expor helper de IP/header)
- Modify: `apps/api/src/users/users.controller.ts` (se necessário para contexto de request)
- Modify: `apps/api/src/admin-users/repositories/audit.repository.ts`

**Step 1: Escrever teste que falha para evento de login**

Teste esperado:
- Chamada de `/users/me` para usuário autenticado deve gerar `AUTH_LOGIN_SUCCEEDED`.
- Requisições repetidas em janela curta (ex.: 10 min) não devem gerar spam de eventos.

**Step 2: Implementar escrita de evento**

No fluxo de `upsertFromClaims`, após sucesso de autenticação:
- Criar `audit_log` com `action = AUTH_LOGIN_SUCCEEDED`, `entityType = USER`, `entityId = user.id`.
- Persistir metadados em `afterData` (ex.: método de auth, origem).

**Step 3: Implementar deduplicação temporal**

Antes de gravar, verificar último evento de login do mesmo usuário e suprimir criação se estiver dentro da janela (ex.: 15 minutos).

**Step 4: Validar testes**

Rodar testes unitários/E2E relacionados ao fluxo `users/me`.

---

### Task 4: Criar endpoint de métricas agregadas para Admin

**Files:**
- Create: `apps/api/src/admin-users/admin-metrics.controller.ts`
- Create: `apps/api/src/admin-users/domains/admin-metrics.service.ts`
- Create: `apps/api/src/admin-users/dto/admin-metrics.dto.ts`
- Modify: `apps/api/src/admin-users/admin-users.service.ts`
- Modify: `apps/api/src/admin-users/admin-users.module.ts`

**Step 1: Escrever teste E2E que falha para `/admin/metrics/access`**

Cobrir:
- 200 para admin.
- 403 para usuário sem permissão.
- Resposta com `kpis`, `series`, `topUsers`.

**Step 2: Definir DTO de query**

Campos:
- `from`, `to`, `window`, `bucket` (`hour`/`day`), `timezone` (IANA).
- Limites de segurança: intervalo máximo (ex.: 90 dias), bucket compatível com janela.

**Step 3: Implementar agregação**

Retornar:
- `kpis`: `activeNow`, `uniqueLoginsWindow`, `avgLoginsPerHour`, `failedAuthWindow` (se disponível).
- `series.loginsByBucket`: pares `{ bucketStart, value }`.
- `series.activeUsersByBucket` (opcional no MVP se já viável com `lastLoginAt`).
- `topUsers`: `{ userId, email, displayName, loginCount, lastLoginAt }`.
- `recentAuthEvents`: últimos N eventos de login/erro de auth.

**Step 4: Garantir preenchimento de buckets vazios**

A série deve vir completa (incluindo horas sem evento com `0`) para o gráfico não “quebrar”.

---

### Task 5: Expor API tipada no frontend

**Files:**
- Create: `apps/web/src/features/admin/api/metrics.ts`
- Modify: `apps/web/src/features/admin/api/index.ts`

**Step 1: Escrever teste de parsing/contrato (Vitest)**

Validar mapeamento do envelope para tipos de métricas.

**Step 2: Implementar client**

Criar função:
- `getAdminAccessMetrics(params)` -> chama `/admin/metrics/access` e retorna payload tipado.

**Step 3: Validar build/typecheck**

Rodar `npm run test` (escopo web) e `npm run build`.

---

### Task 6: Criar painel visual de métricas no Admin

**Files:**
- Create: `apps/web/src/features/admin/AccessMetricsPanel.vue`
- Create: `apps/web/src/features/admin/components/LineChartSimple.vue`
- Modify: `apps/web/src/features/admin/components/AdminSidebar.vue`
- Modify: `apps/web/src/views/AdminView.vue`

**Step 1: Escrever teste de componente (estado)**

Cobrir:
- Loading, empty, erro e sucesso.
- Render de cards + gráfico + tabela top usuários.

**Step 2: Implementar layout e UX**

Painel com:
- Cards de KPI.
- Gráfico principal “Logins por horário”.
- Tabela de “Usuários com mais acessos”.
- Filtros de janela/timezone e botão atualizar.

**Step 3: Integrar aba no Admin**

Adicionar chave `metrics` no `AdminSidebar` e no roteamento interno do `AdminView`.

---

### Task 7: Instrumentar observabilidade e hardening do endpoint

**Files:**
- Modify: `apps/api/src/admin-users/domains/admin-metrics.service.ts`
- Modify: `apps/api/src/common/http/request-logger.ts` (apenas se necessário para tags extras)

**Step 1: Limites de consulta**

Impor proteção:
- Janela máxima.
- Page/limit máximo para listas auxiliares.
- Timeout de query agregada.

**Step 2: Cache curto de agregação**

Adicionar cache em memória por chave (`from,to,bucket,timezone`) com TTL curto (30-60s) para evitar carga desnecessária em refreshs frequentes do painel.

**Step 3: Logs operacionais**

Registrar duração e cardinalidade das consultas agregadas para tuning futuro.

---

### Task 8: Cobertura de testes e validação final

**Files:**
- Modify: `apps/api/test/full.e2e-spec.ts`
- Create: `apps/api/test/metrics.e2e-spec.ts` (se preferir separar)
- Create: `apps/web/src/features/admin/__tests__/access-metrics-panel.test.ts` (opcional, recomendado)

**Step 1: E2E backend**

Casos:
- Admin autorizado.
- Não-admin bloqueado.
- Intervalo inválido retorna 400.
- Buckets vazios retornam zero.

**Step 2: Testes frontend**

Casos:
- Render correto dos KPIs.
- Alteração de janela recarrega dados.
- Gráfico não quebra com série vazia.

**Step 3: Smoke manual**

Checklist:
- Troca de abas preserva estabilidade.
- Tempo de carregamento aceitável.
- Dados coerentes com `audit_log`.

---

## Proposed MVP Scope (recomendado)

1. `AUTH_LOGIN_SUCCEEDED` em `audit_log` com dedupe temporal.
2. Endpoint `/admin/metrics/access` com:
- KPIs principais.
- Série de logins por hora.
- Top usuários por logins.
3. Nova aba `Metrics` no Admin com gráfico simples e filtros de janela/timezone.

## Out of MVP (fase 2)

1. Sessões concorrentes em tempo real com heartbeat explícito.
2. Métricas avançadas por customer/report/página.
3. Exportação CSV/PNG de dashboards.
4. Alertas automáticos de anomalia.

## Riscos e Mitigações

- **Risco:** spam de eventos se login for registrado a cada request.
  - **Mitigação:** dedupe temporal por usuário (janela mínima).
- **Risco:** query pesada em `audit_log`.
  - **Mitigação:** índice `action + created_at`, limite de janela e cache curto.
- **Risco:** divergência de timezone em leitura de gráfico.
  - **Mitigação:** backend recebe timezone IANA e preenche buckets normalizados.

## Critérios de Pronto (DoD)

1. Cards do EPIC atualizados e aprovados.
2. Endpoint de métricas disponível com guard de admin.
3. Aba Metrics funcional com estados `loading/erro/empty`.
4. Testes E2E e build verde.
5. Sem necessidade de refresh manual para atualizar painel.

