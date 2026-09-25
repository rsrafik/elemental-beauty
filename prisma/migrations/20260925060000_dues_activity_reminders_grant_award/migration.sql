-- AlterTable
ALTER TABLE "events" ADD COLUMN     "reminder_sent_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "grants" ADD COLUMN     "amount_awarded" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "labs" ADD COLUMN     "reminder_sent_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "year_targets" ADD COLUMN     "dues_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "dues_payments" (
    "dues_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "school_year" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paid_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "transaction_id" INTEGER,

    CONSTRAINT "dues_payments_pkey" PRIMARY KEY ("dues_id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "activity_id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "actor_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" INTEGER,
    "target_name" TEXT,
    "points" INTEGER,
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("activity_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dues_payments_transaction_id_key" ON "dues_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "dues_payments_school_year_idx" ON "dues_payments"("school_year");

-- CreateIndex
CREATE UNIQUE INDEX "dues_payments_member_id_school_year_key" ON "dues_payments"("member_id", "school_year");

-- CreateIndex
CREATE INDEX "activity_log_created_at_idx" ON "activity_log"("created_at");

-- CreateIndex
CREATE INDEX "activity_log_target_id_idx" ON "activity_log"("target_id");

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dues_payments" ADD CONSTRAINT "dues_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- Hand-written checks ----------

-- a grant awarded nothing is a denied one, not an awarded one of 0
ALTER TABLE "grants"
    ADD CONSTRAINT chk_grants_awarded_positive CHECK (amount_awarded IS NULL OR amount_awarded > 0);

ALTER TABLE "year_targets"
    ADD CONSTRAINT chk_year_targets_dues CHECK (dues_amount >= 0);

-- 0 is a waived year (no ledger row); anything paid is in the ledger
ALTER TABLE "dues_payments"
    ADD CONSTRAINT chk_dues_amount CHECK (amount >= 0),
    ADD CONSTRAINT chk_dues_school_year CHECK (school_year ~ '^\d{4}–\d{2}$');
