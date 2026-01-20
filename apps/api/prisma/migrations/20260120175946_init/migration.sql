-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('pending', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "membership_role" AS ENUM ('owner', 'admin', 'member', 'viewer');

-- CreateEnum
CREATE TYPE "rls_value_type" AS ENUM ('text', 'int', 'uuid');

-- CreateEnum
CREATE TYPE "rls_default_behavior" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "rls_target_status" AS ENUM ('draft', 'active');

-- CreateEnum
CREATE TYPE "rls_rule_op" AS ENUM ('include', 'exclude');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "app_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "role_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_app_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "customer_id" UUID,
    "app_role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_app_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_customer_memberships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "role" "membership_role" NOT NULL DEFAULT 'viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_customer_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entra_sub" TEXT NOT NULL,
    "entra_oid" UUID,
    "email" CITEXT,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),
    "status" "user_status" NOT NULL DEFAULT 'pending',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_workspaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "workspace_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_ref_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "report_name" TEXT,
    "dataset_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_workspace_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "workspace_ref_id" UUID NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_workspace_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_report_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "report_ref_id" UUID NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_report_permissions_pkey" PRIMARY KEY ("id")
);

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

    CONSTRAINT "rls_target_pkey" PRIMARY KEY ("id")
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

    CONSTRAINT "rls_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_app_key_key" ON "applications"("app_key");

-- CreateIndex
CREATE UNIQUE INDEX "app_roles_application_id_role_key_key" ON "app_roles"("application_id", "role_key");

-- CreateIndex
CREATE UNIQUE INDEX "user_app_roles_user_id_application_id_customer_id_app_role__key" ON "user_app_roles"("user_id", "application_id", "customer_id", "app_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "idx_memberships_customer" ON "user_customer_memberships"("customer_id");

-- CreateIndex
CREATE INDEX "idx_memberships_user" ON "user_customer_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_customer_memberships_user_id_customer_id_key" ON "user_customer_memberships"("user_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_entra_sub_key" ON "users"("entra_sub");

-- CreateIndex
CREATE UNIQUE INDEX "users_entra_oid_key" ON "users"("entra_oid");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_log"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_bi_workspaces_customer" ON "bi_workspaces"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_workspaces_customer_id_workspace_id_key" ON "bi_workspaces"("customer_id", "workspace_id");

-- CreateIndex
CREATE INDEX "idx_bi_reports_workspace" ON "bi_reports"("workspace_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_reports_workspace_ref_id_report_id_key" ON "bi_reports"("workspace_ref_id", "report_id");

-- CreateIndex
CREATE INDEX "idx_bi_ws_perm_user" ON "bi_workspace_permissions"("user_id");

-- CreateIndex
CREATE INDEX "idx_bi_ws_perm_workspace" ON "bi_workspace_permissions"("workspace_ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_workspace_permissions_user_id_workspace_ref_id_key" ON "bi_workspace_permissions"("user_id", "workspace_ref_id");

-- CreateIndex
CREATE INDEX "idx_bi_report_perm_report" ON "bi_report_permissions"("report_ref_id");

-- CreateIndex
CREATE INDEX "idx_bi_report_perm_user" ON "bi_report_permissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_report_permissions_user_id_report_ref_id_key" ON "bi_report_permissions"("user_id", "report_ref_id");

-- CreateIndex
CREATE INDEX "idx_rls_target_dataset" ON "rls_target"("dataset_id");

-- CreateIndex
CREATE INDEX "idx_rls_target_key" ON "rls_target"("target_key");

-- CreateIndex
CREATE UNIQUE INDEX "rls_target_dataset_id_target_key_key" ON "rls_target"("dataset_id", "target_key");

-- CreateIndex
CREATE INDEX "idx_rls_rule_target" ON "rls_rule"("target_id");

-- CreateIndex
CREATE INDEX "idx_rls_rule_customer" ON "rls_rule"("customer_id");

-- AddForeignKey
ALTER TABLE "app_roles" ADD CONSTRAINT "app_roles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_app_roles" ADD CONSTRAINT "user_app_roles_app_role_id_fkey" FOREIGN KEY ("app_role_id") REFERENCES "app_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_app_roles" ADD CONSTRAINT "user_app_roles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_app_roles" ADD CONSTRAINT "user_app_roles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_app_roles" ADD CONSTRAINT "user_app_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_customer_memberships" ADD CONSTRAINT "user_customer_memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_customer_memberships" ADD CONSTRAINT "user_customer_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_workspaces" ADD CONSTRAINT "bi_workspaces_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_reports" ADD CONSTRAINT "bi_reports_workspace_ref_id_fkey" FOREIGN KEY ("workspace_ref_id") REFERENCES "bi_workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_workspace_permissions" ADD CONSTRAINT "bi_workspace_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_workspace_permissions" ADD CONSTRAINT "bi_workspace_permissions_workspace_ref_id_fkey" FOREIGN KEY ("workspace_ref_id") REFERENCES "bi_workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_report_permissions" ADD CONSTRAINT "bi_report_permissions_report_ref_id_fkey" FOREIGN KEY ("report_ref_id") REFERENCES "bi_reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_report_permissions" ADD CONSTRAINT "bi_report_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rls_rule" ADD CONSTRAINT "rls_rule_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "rls_target"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rls_rule" ADD CONSTRAINT "rls_rule_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
