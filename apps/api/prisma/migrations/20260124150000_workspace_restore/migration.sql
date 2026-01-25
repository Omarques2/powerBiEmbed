-- Add last_can_view to preserve report permissions when toggling workspace
ALTER TABLE "bi_customer_report_permissions"
ADD COLUMN "last_can_view" BOOLEAN;
