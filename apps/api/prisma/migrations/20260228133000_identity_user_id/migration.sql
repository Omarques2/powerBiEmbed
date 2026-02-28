ALTER TABLE users
  ADD COLUMN IF NOT EXISTS identity_user_id uuid;

UPDATE users
SET identity_user_id = entra_sub::uuid
WHERE identity_user_id IS NULL
  AND entra_sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

CREATE UNIQUE INDEX IF NOT EXISTS users_identity_user_id_key
  ON users(identity_user_id)
  WHERE identity_user_id IS NOT NULL;