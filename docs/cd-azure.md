# CD Main - Azure Container Apps + Static Web Apps (Staging -> Prod)

Este guia descreve o setup de deploy para `pbi-embed` apos a migracao para `sigfarm-auth-platform`.

## 1) Pre-requisitos
- Subscription Azure com permissao para Container Apps e Static Web Apps.
- Repositorio GitHub com Actions habilitado.
- Ambientes GitHub `staging` e `production` configurados.
- Banco Postgres separado por ambiente (`staging` e `prod`).

## 2) Secrets obrigatorios no GitHub Actions
Em `Settings -> Secrets and variables -> Actions`:

Infra/CD:
- `AZURE_CREDENTIALS`
- `AZURE_RESOURCE_GROUP`
- `AZURE_CONTAINER_APP_NAME_STAGING`
- `AZURE_CONTAINER_APP_NAME_PROD`
- `AZURE_CONTAINER_REGISTRY_USERNAME`
- `AZURE_CONTAINER_REGISTRY_PASSWORD`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`
- `STAGING_API_BASE_URL`
- `PROD_API_BASE_URL`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD`

Web:
- `VITE_API_BASE_URL_STAGING`
- `VITE_API_BASE_URL_PROD`

Nota: nao existe mais uso de `VITE_ENTRA_*` no CD.

## 3) Variaveis da API no Azure Container Apps
Para cada app (`pbi-embed-api-staging` e `pbi-embed-api-prod`), configure em:
Azure Portal -> Container App -> Configuration -> Environment variables.

Obrigatorias (auth central):
- `SIGFARM_AUTH_ISSUER`
- `SIGFARM_AUTH_AUDIENCE`
- `SIGFARM_AUTH_JWKS_URL`

Valores esperados por ambiente:

Staging:
- `SIGFARM_AUTH_ISSUER=https://testauth.sigfarmintelligence.com`
- `SIGFARM_AUTH_AUDIENCE=sigfarm-apps`
- `SIGFARM_AUTH_JWKS_URL=https://api-testauth.sigfarmintelligence.com/.well-known/jwks.json`

Prod:
- `SIGFARM_AUTH_ISSUER=https://auth.sigfarmintelligence.com`
- `SIGFARM_AUTH_AUDIENCE=sigfarm-apps`
- `SIGFARM_AUTH_JWKS_URL=https://api-auth.sigfarmintelligence.com/.well-known/jwks.json`

Obrigatorias (app):
- `DATABASE_URL`
- `PBI_TENANT_ID`
- `PBI_CLIENT_ID`
- `PBI_CLIENT_SECRET`
- `CORS_ORIGINS`
- `TRUST_PROXY=true`

Regras de seguranca:
1. `SIGFARM_AUTH_JWKS_URL` deve apontar para `api-auth`/`api-testauth` (nunca `auth-web`).
2. Nunca compartilhar valores de `prod` com `staging`.
3. `DATABASE_URL` de `prod` nunca pode ser usado em `staging`.

## 4) Variaveis web no workflow
`web-staging` e `web-prod` usam apenas:
- `VITE_API_BASE_URL`
- `VITE_SIGFARM_AUTH_API_BASE_URL`
- `VITE_SIGFARM_AUTH_PORTAL_BASE_URL`
- `VITE_SIGFARM_APP_BASE_URL`
- `VITE_SIGFARM_AUTH_ALLOWED_RETURN_ORIGINS`
- `VITE_SIGFARM_AUTH_DEFAULT_RETURN_TO`

O workflow falha antes do deploy se alguma delas estiver vazia.

Valores esperados por ambiente:

Staging:
- `VITE_SIGFARM_AUTH_API_BASE_URL=https://api-testauth.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_PORTAL_BASE_URL=https://testauth.sigfarmintelligence.com`
- `VITE_SIGFARM_APP_BASE_URL=https://testbi.sigfarmintelligence.com`

Prod:
- `VITE_SIGFARM_AUTH_API_BASE_URL=https://api-auth.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_PORTAL_BASE_URL=https://auth.sigfarmintelligence.com`
- `VITE_SIGFARM_APP_BASE_URL=https://bi.sigfarmintelligence.com`

## 5) Promocao Staging -> Prod
Ordem do `cd-main.yml`:
1. build/push da imagem da API
2. migrate + deploy API em staging
3. deploy web staging
4. migrate + deploy API prod (apos gate de environment)
5. deploy web prod

Boas praticas:
- manter `production` com `Required reviewers`.
- promover prod apenas apos checklist de rede/autenticacao em staging.

## 6) Checklist de rede para cutover (staging)
Validar em ordem:
1. `app-web -> auth-web/login -> app-web/auth/callback`
2. `POST /v1/auth/refresh` no `auth-api`
3. chamadas privadas do app com bearer no `Authorization`
4. `GET /users/me` (ou `/v1/users/me`) retorna `200` para sessao valida
5. usuario `pending` continua redirecionado para `/pending`

## 7) Rollback seguro
Estrutura de rollback por app/ambiente:

API:
1. Reverter Container App para revisao anterior estavel.
2. Confirmar `GET /health` e `GET /ready` com `200`.

WEB:
1. Reexecutar workflow com commit/tag anterior estavel.
2. Validar login/callback sem loop.

Banco:
1. Migracao de identidade e additive; nao remover `entra_sub` no primeiro rollback.
2. Em incidente severo, restaurar snapshot apenas no ambiente afetado.

Observabilidade imediata (primeira janela de 60 min):
- taxa de `401` e `403`
- taxa de redirecionamento para `/pending`
- erros de callback/login loop
