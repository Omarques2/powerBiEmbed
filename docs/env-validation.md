# Fluxo de ambientes (Local -> Staging -> Prod)

Este guia define a validacao operacional apos o cutover para `sigfarm-auth-platform`.

## 1) Objetivo
- Garantir deploy previsivel de auth central em `staging` e `prod`.
- Evitar regressao no comportamento de acesso local (`pending`, `disabled`, `active`).
- Preservar integridade de banco com migracao additive e rollback seguro.

## 2) Gates por ambiente

Local:
- lint, typecheck e testes verdes.
- smoke de login/callback sem loop.

Staging:
- API `/health` e `/ready` com `200`.
- fluxo completo de auth central validado.
- regra de `pending` validada com usuario nao ativo.

Prod:
- deploy somente apos aprovacao manual em environment `production`.
- smoke de auth e rota protegida finalizados antes de encerrar release.

## 3) Checklist de rede (obrigatorio em staging)
Executar nesta ordem:
1. Abrir app e confirmar redirecionamento: `app-web -> auth-web/login`.
2. Concluir login e confirmar retorno para: `app-web/auth/callback`.
3. Confirmar no navegador que houve chamada `POST /v1/auth/refresh` no `auth-api` com sucesso.
4. Confirmar chamadas privadas do app com header `Authorization: Bearer <token>`.
5. Confirmar `GET /users/me` (ou `/v1/users/me`) com `200` para sessao valida.
6. Validar politicas locais:
   - `pending` -> pagina `/pending`
   - `disabled` -> bloqueio `403`
   - `platform_admin` sem membership -> acesso ativo

## 4) Checklist de promocao para prod
1. Verificacoes do item 3 aprovadas em staging.
2. Sem aumento anormal de `401/403` em staging.
3. Sem loop de callback/login.
4. Aprovar environment `production` no GitHub.
5. Repetir smoke basico em prod.

## 5) Rollback por app/ambiente

API rollback:
1. Reverter para revisao anterior no Azure Container Apps.
2. Validar `/health` e `/ready`.
3. Validar endpoint protegido com token valido.

WEB rollback:
1. Reexecutar CD com commit anterior estavel.
2. Validar login, callback e `/pending`.

Banco rollback:
1. Tratar migracoes como additive no primeiro deploy.
2. Nao remover `entra_sub` no primeiro ciclo de cutover/rollback.
3. Restaurar snapshot apenas no ambiente impactado, com janela e responsavel definidos.

## 6) Evidencias minimas para encerramento
- link da pipeline `cd-main` em staging e prod.
- capturas/logs do fluxo login -> callback -> `/users/me`.
- registro de validacao de `pending` em staging.
- registro de observabilidade da primeira hora (401/403/pending/loop).
