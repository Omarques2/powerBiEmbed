ALTER TABLE "customers"
ADD COLUMN "can_refresh_model" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "user_customer_memberships"
ADD COLUMN "can_refresh_model_override" BOOLEAN;
