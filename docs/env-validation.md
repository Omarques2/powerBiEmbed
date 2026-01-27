# Fluxo de ambientes (Local -> Staging -> Prod)

Este guia documenta o fluxo de validacao dos ambientes e os cuidados com banco de dados.

## Objetivo
- Garantir que o desenvolvimento e os testes usem **DB test** (nunca prod).
- Garantir que o deploy em **staging** seja automatico via CI/CD.
- Garantir que o deploy em **prod** seja somente apos validacao manual em staging.
- Preservar **integridade total** do DB prod (sem reset).

## Ambientes e responsabilidades

### Local (dev)
- **API**: roda local apontando para `TEST_DATABASE_URL`.
- **WEB**: roda local apontando para API local.
- **Banco**: usar apenas `pbi_embed_test` (resetavel).

Checklist local:
- `npm run lint` (api/web)
- `npm run test` (api/web)
- `npm run test:e2e` (api com TEST_DATABASE_URL)
- Smoke manual rapido (login + /health + fluxo basico).

### Staging
- **API**: container apps staging (deploy automatico pelo Actions).
- **WEB**: unico ambiente SWA (como hoje), valida UI contra API staging.
- **Banco**: pode ser DB test ou shadow, mas **nunca** prod.

Checklist staging (minimo):
- `GET /health` e `GET /ready` 200
- Login + navegação principal
- Fluxo admin basico (customers, users, perms)
- Embed/preview principais (com permissao)

### Prod
- **API**: container apps prod (deploy manual/approve).
- **WEB**: mesmo SWA (quando usar prod, garantir API_BASE_URL correta).
- **Banco**: `pbi_embed` (prod). **Nao resetar.**

Checklist prod (minimo):
- `GET /health` e `GET /ready` 200
- Login + home
- Admin (somente leitura, sem operacoes destrutivas no primeiro deploy)

## Fluxo recomendado de deploy
1. **Local**: testes e lint ok.
2. **Push main**: CI roda. CD publica **staging**.
3. **Validar staging**: smoke test e checagem de features criticas.
4. **Promover prod**: liberar deploy para prod (manual/approve).

## Protecoes essenciais
- `TEST_DATABASE_URL` obrigatorio em `test:e2e`.
- Actions nunca roda `migrate dev` em prod.
- Variaveis separadas por ambiente (staging/prod).
- DB prod nunca resetado.

## Notas
- Caso exista necessidade de validar feature de DB, sempre use DB test.
- Se for necessario seed de prod, realizar manualmente e com revisao.
