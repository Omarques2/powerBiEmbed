# Sigfarm Auth Baseline (Etapa 1)

Este documento fixa o baseline da integracao do `pbi-embed` com o `sigfarm-auth-platform` antes da migracao de runtime.

## 1) Contrato e versoes congeladas

Fonte de verdade de contrato:
- `@sigfarm/auth-contracts` v0.1.0 (artefato vendorizado)

SDKs congelados neste repositorio:
- `vendor/sigfarm-auth-platform/dist-packages/sigfarm-auth-contracts-0.1.0.tgz`
- `vendor/sigfarm-auth-platform/dist-packages/sigfarm-auth-client-vue-0.1.0.tgz`
- `vendor/sigfarm-auth-platform/dist-packages/sigfarm-auth-guard-nest-0.1.0.tgz`

Integridade:
- manifesto: `vendor/sigfarm-auth-platform/dist-packages/SHA256SUMS`
- verificador: `vendor/sigfarm-auth-platform/verify-checksums.js`

Politica:
1. Atualizacao de SDK so via novos `.tgz` + checksum atualizado.
2. Nunca apontar dependencia para branch/commit remoto diretamente.
3. Em CI, validar checksum antes de buildar imagens.

## 2) Estrategia de consumo dos SDKs

Frontend (`apps/web/package.json`):
- `@sigfarm/auth-client-vue` via `file:../../vendor/...`
- `@sigfarm/auth-contracts` via `file:../../vendor/...`

Backend (`apps/api/package.json`):
- `@sigfarm/auth-guard-nest` via `file:../../vendor/...`
- `@sigfarm/auth-contracts` via `file:../../vendor/...`

Motivo:
- build reprodutivel em dev/CI;
- sem drift de versao entre web/api;
- reduz risco de quebra em cutover.

## 3) Matriz de dominios por ambiente

## 3.1 Staging

- `auth-web`: `https://testauth.sigfarmintelligence.com`
- `auth-api`: `https://api-testauth.sigfarmintelligence.com`
- `app-web (pbi-embed)`: `https://testbi.sigfarmintelligence.com`
- `app-api (pbi-embed)`: valor de `VITE_API_BASE_URL_STAGING`

Frontend vars alvo:
- `VITE_SIGFARM_AUTH_API_BASE_URL=https://api-testauth.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_PORTAL_BASE_URL=https://testauth.sigfarmintelligence.com`
- `VITE_SIGFARM_APP_BASE_URL=https://testbi.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_ALLOWED_RETURN_ORIGINS=https://testbi.sigfarmintelligence.com,https://testauth.sigfarmintelligence.com,https://testlandwatch.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_DEFAULT_RETURN_TO=https://testbi.sigfarmintelligence.com/`

Backend vars alvo:
- `SIGFARM_AUTH_ISSUER=https://testauth.sigfarmintelligence.com`
- `SIGFARM_AUTH_AUDIENCE=sigfarm-apps`
- `SIGFARM_AUTH_JWKS_URL=https://api-testauth.sigfarmintelligence.com/.well-known/jwks.json`

## 3.2 Production

- `auth-web`: `https://auth.sigfarmintelligence.com`
- `auth-api`: `https://api-auth.sigfarmintelligence.com`
- `app-web (pbi-embed)`: `https://bi.sigfarmintelligence.com`
- `app-api (pbi-embed)`: valor de `VITE_API_BASE_URL_PROD`

Frontend vars alvo:
- `VITE_SIGFARM_AUTH_API_BASE_URL=https://api-auth.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_PORTAL_BASE_URL=https://auth.sigfarmintelligence.com`
- `VITE_SIGFARM_APP_BASE_URL=https://bi.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_ALLOWED_RETURN_ORIGINS=https://bi.sigfarmintelligence.com,https://auth.sigfarmintelligence.com,https://landwatch.sigfarmintelligence.com`
- `VITE_SIGFARM_AUTH_DEFAULT_RETURN_TO=https://bi.sigfarmintelligence.com/`

Backend vars alvo:
- `SIGFARM_AUTH_ISSUER=https://auth.sigfarmintelligence.com`
- `SIGFARM_AUTH_AUDIENCE=sigfarm-apps`
- `SIGFARM_AUTH_JWKS_URL=https://api-auth.sigfarmintelligence.com/.well-known/jwks.json`

## 4) Regras de seguranca desta fase

1. `SIGFARM_AUTH_JWKS_URL` sempre em `auth-api` (nunca `auth-web`).
2. `returnTo` deve ser validado por allowlist de origins.
3. Nao registrar tokens/sessoes em logs.
4. Remocao de MSAL/Entra direto sera feita nas proximas etapas; este baseline prepara CI e dependencias.
