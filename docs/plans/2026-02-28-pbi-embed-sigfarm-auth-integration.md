# Plano de Integracao: pbi-embed -> Sigfarm Auth Platform

**Objetivo:** remover por completo o auth legado (MSAL/Entra direto) do `pbi-embed` e integrar o produto ao `sigfarm-auth-platform`, preservando a politica local de `pending` para usuarios nao ativos.

**Base de referencia analisada:**
- `C:/Users/Sigfarm/Desktop/Github/sigfarm-auth-platform/docs/sigfarm-auth-integration-playbook.md`
- `C:/Users/Sigfarm/Desktop/Github/sigfarm-auth-platform/docs/plans/2026-02-18-epic-04-05-integracao-landwatch-pbi-embed.md`
- Integracao ja validada no `LandWatch` (frontend, backend, env, CI/CD, testes).

**Diferenca obrigatoria do pbi-embed em relacao ao LandWatch:**
- manter a regra de acesso local:
  - `active` + (membership ativa **ou** `platform_admin`) => entra no app
  - `pending` => tela `/pending`
  - `disabled` => bloqueio

---

## Invariantes de seguranca (nao negociaveis)

1. O `pbi-embed` nao autentica direto em Entra/Google.
2. Backend valida JWT apenas com:
   - `SIGFARM_AUTH_ISSUER`
   - `SIGFARM_AUTH_AUDIENCE`
   - `SIGFARM_AUTH_JWKS_URL` (sempre em `api-auth`/`api-testauth`, nunca `auth-web`)
3. `returnTo` sempre sanitizado por allowlist de origens.
4. Sem bearer em rota privada => `401`.
5. Sem loop login/callback.

---

## Plano em 6 etapas logicas

## 1) Preparacao, contrato e baseline

**Entregas:**
- Congelar contrato `v1` do auth platform (`@sigfarm/auth-contracts`).
- Definir estrategia de consumo dos SDKs (recomendado: mesmo modelo do LandWatch via `vendor/sigfarm-auth-platform/dist-packages/*.tgz` + checksum).
- Registrar matriz de dominios por ambiente (`auth-web`, `auth-api`, `app-web`, `app-api`).

**Arquivos-alvo principais:**
- `apps/web/package.json`
- `apps/api/package.json`
- `.github/workflows/cd-main.yml`
- `vendor/sigfarm-auth-platform/*` (novo no pbi-embed)

**Gate de saida:**
- dependencias e versoes definidas para frontend/backend;
- estrategia de distribuicao dos SDKs aprovada;
- sem ambiguidade de dominio staging/prod.

## 2) Migracao do frontend para auth central

**Entregas:**
- Remover `@azure/msal-browser` e toda logica MSAL.
- Criar `apps/web/src/auth/sigfarm-auth.ts` (espelho LandWatch) com:
  - `createAuthClient`
  - sanitizacao de `returnTo`
  - `buildAuthPortalLoginUrl`, `buildAuthCallbackReturnTo`, `buildProductLoginRoute`
- Reescrever `auth.ts`, `http.ts`, `router` e views `Login/Callback/Pending` para fluxo:
  - login central -> callback -> `exchangeSession` -> `/users/me`
- Manter regra de `pending` no frontend (nao liberar `/app`/`/admin` para usuario nao ativo).

**Arquivos-alvo principais:**
- `apps/web/src/auth/auth.ts`
- `apps/web/src/auth/me.ts`
- `apps/web/src/api/http.ts`
- `apps/web/src/router/index.ts` (e opcionalmente `router/auth-guard.ts`)
- `apps/web/src/views/LoginView.vue`
- `apps/web/src/views/CallbackView.vue`
- `apps/web/src/views/PendingView.vue`
- `apps/web/.env.example` (novo; hoje nao existe)

**Gate de saida:**
- nenhum import de `@azure/msal-browser`;
- login/callback/logout funcionando com auth central;
- sem open redirect em `returnTo`;
- `/pending` preservado para nao ativos.

## 3) Migracao do backend para JWT da auth platform

**Entregas:**
- Substituir `AuthGuard` atual por `SigfarmAuthGuard` (`@sigfarm/auth-guard-nest`).
- Remover `EntraJwtService` e claims Entra-only como fonte primaria.
- Migrar `Claims` para `AccessTokenClaims`.
- Atualizar `config.schema` para exigir `SIGFARM_AUTH_*`.
- Preservar regra local de autorizacao (`pending`, membership ativa, `platform_admin`).

**Arquivos-alvo principais:**
- `apps/api/src/auth/auth.guard.ts`
- `apps/api/src/auth/claims.type.ts`
- `apps/api/src/auth/authed-request.type.ts`
- `apps/api/src/auth/entra-jwt.service.ts` (remover)
- `apps/api/src/auth/active-user.guard.ts`
- `apps/api/src/auth/platform-admin.guard.ts`
- `apps/api/src/config/config.schema.ts`
- `apps/api/.env.example`

**Gate de saida:**
- token invalido/issuer errado/audience errada/JWKS invalido => `401`;
- sem bearer em rota privada => `401`;
- `disabled` => `403`;
- `pending` continua pendente (nao vira ativo por engano).

## 4) Migracao de identidade local para `identity_user_id` (additive)

**Entregas:**
- Criar coluna `identity_user_id` em `users` + indice unico parcial.
- Atualizar Prisma model e toda resolucao de usuario para chave principal `identityUserId`.
- Manter `entra_sub` apenas como campo legado de transicao (sem dependencia funcional).
- Atualizar fluxo de pre-cadastro (`pre_...`) para funcionar com `identity_user_id` sem quebrar o pending.

**Arquivos-alvo principais:**
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/<timestamp>_identity_user_id/migration.sql`
- `apps/api/src/users/users.service.ts`
- `apps/api/src/auth/active-user.guard.ts`
- `apps/api/src/auth/platform-admin.guard.ts`
- `apps/api/src/admin-users/repositories/user.repository.ts`
- `apps/api/src/admin-users/domains/admin-actor.service.ts`
- `apps/api/src/admin-rls/admin-rls.service.ts`
- testes/helpers que hoje usam `entraSub`

**Gate de saida:**
- sem duplicacao de usuario em primeiro login;
- lookup por identidade central funcionando em todo o dominio admin/RLS/powerbi;
- regra de pending preservada ponta-a-ponta.

## 5) Testes, qualidade e seguranca de migracao

**Entregas:**
- Adotar cobertura minima igual ao LandWatch para os blocos de auth:
  - frontend: guard, callback, returnTo
  - backend: e2e de guard JWT (issuer/audience/jwks), active-user behavior, `/users/me`
- Adaptar helpers e2e que hoje simulam `entraSub`.
- Rodar quality gates (lint, typecheck, unit, e2e, build).

**Pacote de testes minimo (obrigatorio):**
1. sem sessao em rota privada -> redireciona login.
2. callback com sucesso -> destino seguro.
3. callback sem sessao -> volta para login sem loop.
4. usuario sem membership e sem admin -> `pending`.
5. `platform_admin` sem membership -> acesso ativo.
6. token mal assinado/issuer/audience incorretos -> `401`.

**Gate de saida:**
- suite de auth verde em web/api;
- sem regressao nos fluxos admin/powerbi.

## 6) Cutover de ambiente, deploy e rollback seguro

**Entregas:**
- Trocar variaveis do CI/CD de `VITE_ENTRA_*` para `VITE_SIGFARM_AUTH_*`.
- Configurar backend com `SIGFARM_AUTH_*` por ambiente.
- Validar checklist de rede no staging:
  - app -> auth-web/login -> app/auth/callback
  - `POST /v1/auth/refresh` no auth-api
  - chamadas privadas com bearer
  - `GET /users/me` (ou `/v1/users/me`, conforme rota final) com 200 para sessao valida
- Promover para producao apos checklist completo.

**Arquivos-alvo principais:**
- `.github/workflows/cd-main.yml`
- segredos/envs em Azure/GitHub
- docs operacionais (`docs/cd-azure.md`, `docs/env-validation.md`)

**Rollback planejado:**
- rollback por app/ambiente;
- migracao de banco additive (nao remover `entra_sub` no primeiro deploy);
- manter janela curta de observacao com logs de `401/403`, loop login e taxa de `pending`.

---

## Riscos atuais identificados e acoes no plano

1. `apps/web/.env` esta versionado no repo.
   - Acao: remover do versionamento, adicionar ignore explicito e substituir por `.env.example`.
2. `.gitignore` raiz esta inconsistente para segredos.
   - Acao: normalizar ignore de arquivos de ambiente no nivel raiz.
3. `npm audit` reportou vulnerabilidades em dependencias (ex.: `axios`, `hono`, `minimatch`).
   - Acao: atualizar lockfiles/dependencias dentro da janela da migracao e rerodar auditoria antes do cutover final.

---

## Definicao de pronto

1. Nenhum uso de MSAL/Entra direto no `pbi-embed`.
2. Auth frontend/backend 100% via `sigfarm-auth-platform`.
3. Politica local de `pending` mantida sem regressao.
4. JWT validado via JWKS central com `SIGFARM_AUTH_*`.
5. Testes minimos de auth e autorizacao passando.
6. Checklist de seguranca e deploy concluido em staging antes de producao.
