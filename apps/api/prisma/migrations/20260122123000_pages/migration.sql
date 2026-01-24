-- CreateTable
CREATE TABLE "bi_report_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_ref_id" UUID NOT NULL,
    "page_name" TEXT NOT NULL,
    "display_name" TEXT,
    "page_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_report_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_page_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_ref_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_page_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_page_group_pages" (
    "group_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,

    CONSTRAINT "bi_page_group_pages_pkey" PRIMARY KEY ("group_id","page_id")
);

-- CreateTable
CREATE TABLE "bi_customer_page_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_customer_page_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_user_page_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_user_page_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_customer_page_allowlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_customer_page_allowlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bi_user_page_allowlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "page_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bi_user_page_allowlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bi_report_pages_report_ref_id_page_name_key" ON "bi_report_pages"("report_ref_id", "page_name");

-- CreateIndex
CREATE INDEX "idx_bi_report_pages_report" ON "bi_report_pages"("report_ref_id");

-- CreateIndex
CREATE INDEX "idx_bi_page_groups_report" ON "bi_page_groups"("report_ref_id");

-- CreateIndex
CREATE INDEX "idx_bi_page_group_pages_page" ON "bi_page_group_pages"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_customer_page_groups_customer_id_group_id_key" ON "bi_customer_page_groups"("customer_id", "group_id");

-- CreateIndex
CREATE INDEX "idx_bi_cpg_customer" ON "bi_customer_page_groups"("customer_id");

-- CreateIndex
CREATE INDEX "idx_bi_cpg_group" ON "bi_customer_page_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_user_page_groups_user_id_group_id_key" ON "bi_user_page_groups"("user_id", "group_id");

-- CreateIndex
CREATE INDEX "idx_bi_upg_user" ON "bi_user_page_groups"("user_id");

-- CreateIndex
CREATE INDEX "idx_bi_upg_group" ON "bi_user_page_groups"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_customer_page_allowlist_customer_id_page_id_key" ON "bi_customer_page_allowlist"("customer_id", "page_id");

-- CreateIndex
CREATE INDEX "idx_bi_cpa_customer" ON "bi_customer_page_allowlist"("customer_id");

-- CreateIndex
CREATE INDEX "idx_bi_cpa_page" ON "bi_customer_page_allowlist"("page_id");

-- CreateIndex
CREATE UNIQUE INDEX "bi_user_page_allowlist_user_id_page_id_key" ON "bi_user_page_allowlist"("user_id", "page_id");

-- CreateIndex
CREATE INDEX "idx_bi_upa_user" ON "bi_user_page_allowlist"("user_id");

-- CreateIndex
CREATE INDEX "idx_bi_upa_page" ON "bi_user_page_allowlist"("page_id");

-- AddForeignKey
ALTER TABLE "bi_report_pages" ADD CONSTRAINT "bi_report_pages_report_ref_id_fkey" FOREIGN KEY ("report_ref_id") REFERENCES "bi_reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_page_groups" ADD CONSTRAINT "bi_page_groups_report_ref_id_fkey" FOREIGN KEY ("report_ref_id") REFERENCES "bi_reports"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_page_group_pages" ADD CONSTRAINT "bi_page_group_pages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "bi_page_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_page_group_pages" ADD CONSTRAINT "bi_page_group_pages_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "bi_report_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_customer_page_groups" ADD CONSTRAINT "bi_customer_page_groups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_customer_page_groups" ADD CONSTRAINT "bi_customer_page_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "bi_page_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_user_page_groups" ADD CONSTRAINT "bi_user_page_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_user_page_groups" ADD CONSTRAINT "bi_user_page_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "bi_page_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_customer_page_allowlist" ADD CONSTRAINT "bi_customer_page_allowlist_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_customer_page_allowlist" ADD CONSTRAINT "bi_customer_page_allowlist_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "bi_report_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_user_page_allowlist" ADD CONSTRAINT "bi_user_page_allowlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bi_user_page_allowlist" ADD CONSTRAINT "bi_user_page_allowlist_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "bi_report_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
