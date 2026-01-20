# Reset do banco (EPIC-03)

Este guia descreve como zerar o banco e recriar a baseline do schema. Use apenas em ambientes de teste/staging.

## Avisos
- Este processo apaga todos os dados.
- Use um banco dedicado para testes (ex.: `TEST_DATABASE_URL`).
- Garanta backup se existir alguma informacao que precise ser preservada.

## Opção A (recomendado): recriar o banco inteiro via pgAdmin
1) Abra o pgAdmin e conecte no servidor.
2) Clique com o botao direito no banco alvo -> **Delete/Drop**.
3) Crie novamente o banco:
   - **Databases** -> **Create** -> **Database**.
   - Name: `pbi_embed` (ou o nome que voce usa).
   - Owner: o mesmo usuario do banco atual.
4) Habilite extensoes exigidas:
   - Abra o **Query Tool** e execute:
     - `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
     - `CREATE EXTENSION IF NOT EXISTS "citext";`
5) Gere a nova baseline do Prisma e aplique:
   - No terminal em `apps/api`:
     - `npx prisma migrate dev --name init`

## Opção B: apagar schema public (quando nao quiser dropar o DB)
1) Query Tool:
   - `DROP SCHEMA public CASCADE;`
   - `CREATE SCHEMA public;`
2) Habilite extensoes:
   - `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`
   - `CREATE EXTENSION IF NOT EXISTS "citext";`
3) Gere a nova baseline:
   - `npx prisma migrate dev --name init`

## Reativar Platform Admin (manual)
Para definir um usuario como platform admin manualmente, voce precisa do `entra_sub` (claim `sub` do token).
Passos sugeridos:

1) Descubra o `entra_sub`:
   - Faça login na aplicacao e decodifique o token (claim `sub`).
2) Crie/atualize o usuario:
   - `INSERT INTO users (id, entra_sub, email, display_name, status)`
     `VALUES (gen_random_uuid(), '<ENTRA_SUB>', '<EMAIL>', '<NOME>', 'active')`
     `ON CONFLICT (entra_sub) DO UPDATE SET status = 'active';`
3) Garanta o registro do app:
   - `INSERT INTO applications (id, app_key, name)`
     `VALUES (gen_random_uuid(), 'PBI_EMBED', 'Power BI Embed')`
     `ON CONFLICT (app_key) DO NOTHING;`
4) Garanta o role:
   - `INSERT INTO app_roles (id, application_id, role_key, name)`
     `SELECT gen_random_uuid(), a.id, 'platform_admin', 'Platform Admin'`
     `FROM applications a WHERE a.app_key = 'PBI_EMBED'`
     `ON CONFLICT (application_id, role_key) DO NOTHING;`
5) Vincule o usuario ao role:
   - `INSERT INTO user_app_roles (id, user_id, application_id, app_role_id, customer_id)`
     `SELECT gen_random_uuid(), u.id, a.id, r.id, NULL`
     `FROM users u`
     `JOIN applications a ON a.app_key = 'PBI_EMBED'`
     `JOIN app_roles r ON r.application_id = a.id AND r.role_key = 'platform_admin'`
     `WHERE u.entra_sub = '<ENTRA_SUB>'`
     `ON CONFLICT DO NOTHING;`

Observacao: depois disso, o usuario ja passa no PlatformAdminGuard.
