-- Images stay where they are; each just gets a short fingerprint beside it,
-- so pages can ask for the picture on its own (GET /api/img/...) and keep it
-- cached until it changes, rather than every list carrying the base64.
-- Additive only: nothing existing is changed or removed. The backfill runs
-- inside the database, so no image leaves it.
ALTER TABLE "labs" ADD COLUMN "image_key" TEXT;
ALTER TABLE "events" ADD COLUMN "image_key" TEXT;
ALTER TABLE "users" ADD COLUMN "picture_key" TEXT;
ALTER TABLE "payment_methods" ADD COLUMN "image_key" TEXT;
ALTER TABLE "member_payments" ADD COLUMN "screenshot_key" TEXT;
ALTER TABLE "reimbursements" ADD COLUMN "receipt_key" TEXT;

UPDATE "labs" SET "image_key" = left(md5("image"), 12) WHERE "image" IS NOT NULL;
UPDATE "events" SET "image_key" = left(md5("image"), 12) WHERE "image" IS NOT NULL;
UPDATE "users" SET "picture_key" = left(md5("profile_picture"), 12) WHERE "profile_picture" IS NOT NULL;
UPDATE "payment_methods" SET "image_key" = left(md5("image"), 12) WHERE "image" IS NOT NULL;
UPDATE "member_payments" SET "screenshot_key" = left(md5("screenshot"), 12) WHERE "screenshot" IS NOT NULL;
UPDATE "reimbursements" SET "receipt_key" = left(md5("receipt"), 12) WHERE "receipt" IS NOT NULL;
