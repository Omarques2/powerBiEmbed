# Clone do DB Prod para Staging/Test (Azure PostgreSQL - Dump/Restore)

Este guia descreve como espelhar o banco **prod** em um **DB staging/test**
no **mesmo servidor**, usando `pg_dump` + `pg_restore`.

> Objetivo: ter dados reais para validar migrations e testes sem tocar o DB prod.

## 1) Pre-requisitos
- Servidor Azure PostgreSQL Flexible Server (prod).
- Acesso administrativo ao servidor (usuario com permissao de dump/restore).
- Um DB staging/test vazio (ex: `pbi_embed_staging`).

## 2) Criar o DB staging (GUI)
1. Azure Portal -> PostgreSQL Flexible Server -> Databases.
2. Clique em **Create**.
3. Name: `pbi_embed_staging` (ou similar).
4. Owner: mesmo usuario do prod (ex: `app_user`).

## 3) Dump do DB prod
No terminal (local ou VM com acesso ao servidor):
```
pg_dump --format=custom --no-owner --no-acl ^
  --dbname="postgresql://USER:PASS@HOST:5432/pbi_embed?sslmode=require" ^
  --file=pbi_embed_prod.dump
```

## 4) Restore no DB staging
```
pg_restore --no-owner --no-acl ^
  --dbname="postgresql://USER:PASS@HOST:5432/pbi_embed_staging?sslmode=require" ^
  pbi_embed_prod.dump
```

## 5) Ajustar variaveis/seguranca
1. Atualize o `DATABASE_URL` do **Container App staging**:
   - apontar para `pbi_embed_staging`.
2. Garanta que o firewall do servidor permite acesso do Container App.

## 6) (Opcional) Mascarar dados
Se o staging for usado por varios testers, considere mascarar dados sensiveis:
- Emails
- Nomes
- IDs de clientes

## 7) Fluxo recomendado
1. Dump do prod -> restore no staging.
2. Rodar migrations no staging (via CI/CD).
3. Teste manual e e2e.
4. Promover para prod (imagem/digest aprovado).

## 8) Observacoes
- Este processo **nao** usa PITR e **nao** cria novo servidor.
- Evite rodar esse processo em horario de pico do prod.
