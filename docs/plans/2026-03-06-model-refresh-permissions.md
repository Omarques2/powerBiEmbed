# Model Refresh Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Permitir o botão `Atualizar modelo` por customer (default) com override por usuário, com herança e exceções.

**Architecture:** Persistir um default no customer e um override opcional no membership do usuário. Calcular permissão efetiva por relatório (resolvendo customer de acesso) e usar no frontend para exibir/ocultar o botão. Manter migração não destrutiva.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Vue 3 + Vitest.

---

### Task 1: Testes de regra de permissão (RED)

**Files:**
- Modify: `apps/api/src/bi-authz/bi-authz.service.spec.ts`
- Modify: `apps/web/src/views/__tests__/shell-view-admin-actions.test.ts`

**Step 1: Write the failing test**
- API: validar herança customer/override de usuário para `canRefreshModel`.
- WEB: validar exibição/ocultação do botão com base no endpoint de permissão.

**Step 2: Run test to verify it fails**
- Run: `npm --prefix apps/api test -- bi-authz.service.spec.ts`
- Run: `npm --prefix apps/web test -- shell-view-admin-actions.test.ts`

### Task 2: Migração e schema Prisma

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260306XXXXXX_model_refresh_permissions/migration.sql`

**Step 1: Write the failing test**
- (Coberto na Task 1 com expectativa de campos/efeito).

**Step 2: Write minimal implementation**
- `Customer.canRefreshModel Boolean @default(false)`.
- `UserCustomerMembership.canRefreshModelOverride Boolean?`.

### Task 3: Backend de permissão efetiva + endpoints admin

**Files:**
- Modify: `apps/api/src/bi-authz/bi-authz.service.ts`
- Modify: `apps/api/src/powerbi/powerbi.controller.ts`
- Modify: `apps/api/src/admin-users/domains/admin-customers.service.ts`
- Modify: `apps/api/src/admin-users/domains/admin-memberships.service.ts`
- Modify: `apps/api/src/admin-users/dto/admin-customers.dto.ts`
- Modify: `apps/api/src/admin-users/dto/admin-users.dto.ts`

**Step 1: Write minimal implementation**
- Método backend para resolver permissão efetiva de refresh.
- Endpoint para frontend consultar permissão por report selecionado.
- Patch/update para customer default e membership override.

### Task 4: Frontend (configuração + visibilidade do botão)

**Files:**
- Modify: `apps/web/src/views/ShellView.vue`
- Modify: `apps/web/src/features/admin/UserMembershipEditor.vue`
- Modify: `apps/web/src/features/admin/CustomersPanel.vue`
- Modify: `apps/web/src/features/admin/api/*.ts`

**Step 1: Write minimal implementation**
- Consultar permissão efetiva no shell e ocultar botão.
- Expor toggle customer e seletor de override no usuário.

### Task 5: Validação e segurança

**Files:**
- N/A

**Step 1: Run test to verify it passes**
- Run: `npm --prefix apps/api test -- bi-authz.service.spec.ts`
- Run: `npm --prefix apps/web test -- shell-view-admin-actions.test.ts`

**Step 2: Run broader checks**
- Run: `npm --prefix apps/api test`
- Run: `npm --prefix apps/web test`

**Step 3: Security review**
- Revisar superfícies de autorização alteradas e ausência de bypass.
