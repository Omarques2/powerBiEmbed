-- CreateEnum
CREATE TYPE "rls_value_type" AS ENUM ('text', 'int', 'uuid');

-- CreateEnum
CREATE TYPE "rls_default_behavior" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "rls_target_status" AS ENUM ('draft', 'active');

-- CreateEnum
CREATE TYPE "rls_rule_op" AS ENUM ('include', 'exclude');

-- CreateTable
CREATE TABLE "rls_target" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dataset_id" UUID NOT NULL,
    "target_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "fact_table" TEXT NOT NULL,
    "fact_column" TEXT NOT NULL,
    "value_type" "rls_value_type" NOT NULL,
    "default_behavior" "rls_default_behavior" NOT NULL DEFAULT 'allow',
    "status" "rls_target_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rls_target_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rls_target_key_format" CHECK ("target_key" ~ '^[a-z][a-z0-9_]*$')
);

-- CreateTable
CREATE TABLE "rls_rule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "op" "rls_rule_op" NOT NULL,
    "value_text" TEXT,
    "value_int" INTEGER,
    "value_uuid" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rls_rule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rls_rule_one_value" CHECK (
      (("value_text" IS NOT NULL)::int +
       ("value_int" IS NOT NULL)::int +
       ("value_uuid" IS NOT NULL)::int) = 1
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "rls_target_dataset_id_target_key_key" ON "rls_target"("dataset_id", "target_key");

-- CreateIndex
CREATE INDEX "idx_rls_target_dataset" ON "rls_target"("dataset_id");

-- CreateIndex
CREATE INDEX "idx_rls_target_key" ON "rls_target"("target_key");

-- CreateIndex
CREATE INDEX "idx_rls_rule_target" ON "rls_rule"("target_id");

-- CreateIndex
CREATE INDEX "idx_rls_rule_customer" ON "rls_rule"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rls_rule_text" ON "rls_rule"("target_id", "customer_id", "op", "value_text") WHERE "value_text" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_rls_rule_int" ON "rls_rule"("target_id", "customer_id", "op", "value_int") WHERE "value_int" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "uq_rls_rule_uuid" ON "rls_rule"("target_id", "customer_id", "op", "value_uuid") WHERE "value_uuid" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "rls_rule" ADD CONSTRAINT "rls_rule_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "rls_target"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rls_rule" ADD CONSTRAINT "rls_rule_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- CreateView
CREATE OR REPLACE VIEW "sec_rls_base" AS
SELECT
  r.customer_id,
  t.target_key,
  r.op,
  r.value_text,
  r.value_int,
  r.value_uuid
FROM "rls_rule" r
JOIN "rls_target" t ON t.id = r.target_id
WHERE t.status = 'active'::"rls_target_status";
