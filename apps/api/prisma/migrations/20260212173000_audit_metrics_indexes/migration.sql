CREATE INDEX IF NOT EXISTS "idx_audit_action_created" ON "audit_log" ("action", "created_at");
