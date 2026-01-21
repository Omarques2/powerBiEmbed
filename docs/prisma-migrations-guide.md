# Prisma Migrations - Guia rapido (pbi_embed / pbi_embed_test)

Este guia resume o fluxo de migrations para evitar erros no CI/CD e manter o banco alinhado com o schema.

## Contexto do projeto
- **Producao:** `pbi_embed` (nao resetar).
- **Teste local + staging:** `pbi_embed_test` (pode resetar com frequencia).
- O CI/CD usa `prisma migrate deploy` (aplica apenas migrations pendentes).

## Conceitos rapidos
- `prisma/migrations/`: historico de mudancas.
- `_prisma_migrations`: tabela no banco que registra quais migrations ja foram aplicadas.
- `migrate dev`: cria e aplica nova migration (dev/local).
- `migrate deploy`: aplica migrations pendentes (CI/CD/staging/prod).
- `migrate reset`: apaga e recria tudo (somente bancos descartaveis).

## Fluxo recomendado (dev/local)

### 1) Quando mudar o schema
1. Garanta que `DATABASE_URL` aponta para `pbi_embed_test`.
2. Rode:
   ```bash
   npx prisma migrate dev --name <descricao_curta>
   ```
3. Se houver erro de conflito, provavelmente o banco nao esta limpo (ver secao "Reset completo").

### 2) Reset completo (pbi_embed_test)
Use quando quiser zerar tudo:
1. Garanta `DATABASE_URL` apontando para `pbi_embed_test`.
2. Rode:
   ```bash
   npx prisma migrate reset
   ```
3. Se o projeto exige views auxiliares, siga o passo de reset no guia `docs/db-reset.md`.

## Fluxo recomendado (staging)
- Staging usa `pbi_embed_test` e pode ser resetado quando necessario.
- Depois do reset, aplicar migrations:
  ```bash
  npx prisma migrate deploy
  ```
- Se o CI/CD ja roda `migrate deploy`, basta garantir que o banco esteja alinhado.

## Fluxo recomendado (producao)
- **Nunca** use `migrate reset` em `pbi_embed`.
- Apenas use:
  ```bash
  npx prisma migrate deploy
  ```
- Se o deploy falhar com erro "already exists":
  - O banco e as migrations estao fora de sincronia.
  - Resolva antes de commitar (ver secao abaixo).

## O que rodar antes de commitar (para evitar falha no Actions)
1. Garanta que `migrations/` esta atualizado com o schema atual.
2. Verifique se o banco alvo esta alinhado:
   ```bash
   npx prisma migrate deploy
   ```
3. Se aparecer erro "already exists":
   - Em **banco descartavel** (staging/test): faça reset e rode `migrate deploy`.
   - Em **banco persistente**: use `migrate resolve` para marcar a migration como aplicada (somente se o schema ja existe).

Exemplo (marcar migration como aplicada):
```bash
npx prisma migrate resolve --applied <nome_da_migration>
```

## Checklist rapido
- [ ] `DATABASE_URL` aponta para o banco correto.
- [ ] `npx prisma migrate deploy` roda sem erro.
- [ ] `prisma/migrations/` esta com historico consistente.
- [ ] Banco de teste foi resetado quando necessario.

## Dicas para evitar erros comuns
- Se recriou migrations (nova "init"), **limpe o banco** antes de aplicar.
- Nunca apague migrations antigas se o banco ja foi migrado; prefira nova migration incremental.
- Se houver divergencia entre schema local e banco, o `migrate deploy` vai falhar no CI.

