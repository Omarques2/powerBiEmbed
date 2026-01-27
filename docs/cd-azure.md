# CD Main - Azure Container Apps + Static Web Apps (Staging -> Prod)

Este guia descreve como configurar o CD no Azure para a API (Container Apps) e o Web (Static Web Apps),
com separacao real de ambientes e promocao controlada (staging -> prod).

## 1) Pre-requisitos
- Subscription Azure com permissao para criar recursos.
- Repositorio GitHub com Actions habilitado.
- Banco Postgres acessivel a partir do GitHub Actions.
- Ambientes separados: **staging** (teste) e **prod**.

## 2) Criar Service Principal para o GitHub Actions (somente GUI)
1. Azure Portal -> Entra ID -> App registrations -> New registration.
2. Name: `pbi-embed-cd`, Account type: "Single tenant", Register.
3. Guarde:
   - Application (client) ID
   - Directory (tenant) ID
4. Azure Portal -> Entra ID -> App registrations -> `pbi-embed-cd` -> Certificates & secrets -> New client secret.
5. Em "Description", use um nome claro, por exemplo: `github-actions-cd` (esse e o nome da client secret).
6. Selecione um "Expires" adequado (ex: 6 ou 12 meses) e clique "Add".
7. Copie o **Value** do secret (nao o Secret ID). Esse valor aparece uma unica vez.
8. Azure Portal -> Resource groups -> selecione o Resource Group alvo -> Access control (IAM) -> Add -> Add role assignment.
9. Role: `Contributor` (ou `Owner` se necessario).
10. Assign access to: "User, group, or service principal", selecione `pbi-embed-cd`, Save.
9. Monte o JSON no formato esperado pelo GitHub Actions (preencha com os IDs que voce ja coletou):
   ```
   {
     "clientId": "",
     "clientSecret": "",
     "subscriptionId": "",
     "tenantId": ""
   }
   ```
10. Crie o secret no GitHub:
    1) GitHub -> Settings -> Secrets and variables -> Actions.
    2) Clique em "New repository secret".
    3) Name: `AZURE_CREDENTIALS`
    4) Secret: cole o JSON acima (com clientId, clientSecret, subscriptionId e tenantId).
    5) Save.

## 3) Container Registry (GHCR)
O workflow usa GHCR (`ghcr.io`). Para o Azure puxar imagens privadas:
1. Crie um PAT no GitHub com permissoes:
   - `read:packages` (obrigatorio)
   - `repo` (se o repo for privado)
   Caminho: GitHub -> Settings -> Developer settings -> Personal access tokens (classic) -> Generate new token.
2. Salve o PAT como secret no GitHub:
   - Name: `AZURE_CONTAINER_REGISTRY_PASSWORD`
3. Defina o usuario do registry:
   - `AZURE_CONTAINER_REGISTRY_USERNAME` = seu user/organization do GitHub (o mesmo que aparece em `ghcr.io/<usuario>`).
4. Confirme o nome da imagem usado no workflow:
   - Em `.github/workflows/cd-main.yml`, o `IMAGE_NAME` e o `REGISTRY` geram a imagem:  
     `ghcr.io/<github_owner_lower>/pbi-embed-api:<sha>` (owner sempre em minusculas).

## 4) Criar recursos no Azure (API)
1. Criar Resource Group:
   - Azure Portal -> Resource groups -> Create.
   - Name: ex `rg-pbi-embed`
   - Region: escolha uma regiao proxima ao seu banco (ex: Brazil South).
2. Criar Container Apps Environment:
   - Azure Portal -> Container Apps Environments -> Create.
   - Resource Group: o criado acima
   - Name: ex `cae-pbi-embed`
   - Region: a mesma do RG
3. Criar Container App (staging):
   - Azure Portal -> Container Apps -> Create.
   - Name: `pbi-embed-api-staging`
   - Resource Group: o mesmo do passo 1
   - Environment: o criado no passo anterior
   - Container image: pode usar placeholder (sera atualizado pelo workflow)
   - Ingress: External.
   - Target port: `3001`.
   - Transport: HTTP
   - Dapr: disabled (a menos que voce precise)
   - Min/Max replicas: use 0/1 se quiser economizar, ou 1/2 para manter sempre ativo.
4. Criar Container App (prod) com os mesmos parametros:
   - Name: `pbi-embed-api-prod`

## 5) Configurar environment variables da API no Azure
Para cada Container App (staging/prod), configure em:
Azure Portal -> Container App -> Configuration -> Environment variables -> Add.

Valores e onde encontrar:
- `DATABASE_URL`
  - **Staging** aponta para DB de teste/staging.
  - **Prod** aponta para DB prod (nunca use DB de teste).
  - Azure Portal -> Postgres -> Connection strings -> copie a string do user/app.
- `ENTRA_API_AUDIENCE`
  - App Registration da API (Entra ID).  
    Azure Portal -> Entra ID -> App registrations -> sua API -> Overview -> Application (client) ID.
- `ENTRA_AUTHORITY_HOST`
  - Normalmente `login.microsoftonline.com` (padrao).
- `ENTRA_JWKS_TENANT`
  - Normalmente `common` ou o seu Tenant ID.
- `PBI_TENANT_ID`
  - Tenant ID do Azure AD que contem o Power BI.
- `PBI_CLIENT_ID`
  - App Registration usado para acessar o Power BI (client credentials).
- `PBI_CLIENT_SECRET`
  - Secret do App Registration do Power BI.
- `CORS_ORIGINS`
  - URL do front-end publicado (Static Web Apps). Ex: `https://<seu-app>.azurestaticapps.net`
- `CORS_CREDENTIALS`
  - `false` (a menos que voce use cookies com credenciais).
- `ENABLE_CSP`
  - `false` inicialmente. Se ativar, configure `CSP_FRAME_SRC`/`CSP_CONNECT_SRC`.
- `CSP_FRAME_SRC`
  - Lista separada por virgula (ex: `https://app.powerbi.com,https://*.powerbi.com`).
- `CSP_CONNECT_SRC`
  - Lista separada por virgula (ex: `https://api.powerbi.com,https://app.powerbi.com`).
- `RATE_LIMIT_ADMIN_WINDOW_MS`
  - Ex: `60000`
- `RATE_LIMIT_ADMIN_MAX`
  - Ex: `60`
- `RATE_LIMIT_AUTH_WINDOW_MS`
  - Ex: `60000`
- `RATE_LIMIT_AUTH_MAX`
  - Ex: `20`
- `TRUST_PROXY` (true quando estiver atras de proxy)
  - Para Container Apps use `true`.
- `DB_SSL_ALLOW_INVALID` (false em staging/prod)
  - `false`

## 6) Static Web Apps (WEB) - Staging e Prod
Crie **duas** Static Web Apps (uma para staging e outra para prod).
1. Azure Portal -> Static Web Apps -> Create.
2. Name: `pbi-embed-web-staging`.
3. Deployment: escolha "Other" (vamos usar token).
4. Defina region e crie.
5. Pegue o token:
   - Static Web App -> Manage deployment token.
6. Salve como secret no GitHub:
   - `AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING`
7. Repita para prod:
   - Name: `pbi-embed-web-prod`
   - Token: `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD`

## 7) Secrets no GitHub
Em `Settings -> Secrets and variables -> Actions`:
- `AZURE_CREDENTIALS` (JSON do SP)
- `AZURE_RESOURCE_GROUP`
- `AZURE_CONTAINER_APP_NAME_STAGING`
- `AZURE_CONTAINER_APP_NAME_PROD`
- `AZURE_CONTAINER_REGISTRY_USERNAME`
- `AZURE_CONTAINER_REGISTRY_PASSWORD`
- `STAGING_DATABASE_URL`
- `PROD_DATABASE_URL`
- `STAGING_API_BASE_URL` (ex: https://<staging-url>)
- `PROD_API_BASE_URL` (ex: https://<prod-url>)
- `AZURE_STATIC_WEB_APPS_API_TOKEN_STAGING`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_PROD`
- `VITE_API_BASE_URL_STAGING`
- `VITE_API_BASE_URL_PROD`
- `VITE_ENTRA_SPA_CLIENT_ID`
- `VITE_ENTRA_AUTHORITY`
- `VITE_ENTRA_REDIRECT_URI`
- `VITE_ENTRA_POST_LOGOUT_REDIRECT_URI`
- `VITE_ENTRA_API_SCOPE`

## 8.1) Node para o build do web
O build do front usa Vite 7 (Node 20+). Garanta `NODE_VERSION=20.19.0` no job `web`.

## 8) Workflow CD (promocao real)
Arquivo: `.github/workflows/cd-main.yml`
- Build & push da imagem da API para GHCR (tag por commit).
- Migrate em staging (`prisma migrate deploy`).
- Deploy no Container App **staging** + `/health` e `/ready`.
- Migrate em prod (`prisma migrate deploy`) **apenas apos aprovacao**.
- Deploy no Container App **prod** usando **digest fixo** (imagem aprovada).
- Deploy do **web staging** e **web prod** em SWAs separados.

### 8.2) Aprovação manual para prod
Crie environments no GitHub:
1. Settings -> Environments -> New environment
2. `staging` e `production`
3. Em `production`, habilite **Required reviewers** (aprovacao manual).

## 9) Validacao final
1. Push em `main` (deploy staging acontece automaticamente).
2. Verifique Actions:
   - `api-staging` e `web-staging` devem finalizar verde.
3. Teste endpoints no staging:
   - `GET /health`
   - `GET /ready`
4. Valide o web **staging**.
5. Apos aprovacao manual, `api-prod` e `web-prod` sao liberados.
6. Valide o web **prod** e endpoints da API prod.
