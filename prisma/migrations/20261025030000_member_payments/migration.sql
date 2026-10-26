-- ============================================================
-- Members paying on their own: the ways to pay the club (the
-- treasurer's "accepted payments" card), the payments they send
-- in for review, and — on a lab or event row — the income row a
-- paid entry wrote, so undoing it takes the right one back out.
-- ============================================================

-- CreateEnum
CREATE TYPE "payment_kind" AS ENUM ('dues', 'fee');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('pending', 'approved', 'rejected', 'reversed');

-- AlterTable
ALTER TABLE "member_event" ADD COLUMN     "door_transaction_id" INTEGER;

-- AlterTable
ALTER TABLE "member_lab" ADD COLUMN     "door_transaction_id" INTEGER;

-- CreateTable
CREATE TABLE "payment_methods" (
    "method_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("method_id")
);

-- CreateTable
CREATE TABLE "member_payments" (
    "payment_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "kind" "payment_kind" NOT NULL,
    "lab_id" INTEGER,
    "event_id" INTEGER,
    "school_year" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method_id" INTEGER,
    "method_title" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "screenshot" TEXT,
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,
    "transaction_id" INTEGER,

    CONSTRAINT "member_payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "member_payments_transaction_id_key" ON "member_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "member_payments_member_id_idx" ON "member_payments"("member_id");

-- CreateIndex
CREATE INDEX "member_payments_lab_id_idx" ON "member_payments"("lab_id");

-- CreateIndex
CREATE INDEX "member_payments_event_id_idx" ON "member_payments"("event_id");

-- CreateIndex
CREATE INDEX "member_payments_status_idx" ON "member_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "member_event_door_transaction_id_key" ON "member_event"("door_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "member_lab_door_transaction_id_key" ON "member_lab"("door_transaction_id");

-- AddForeignKey
ALTER TABLE "member_lab" ADD CONSTRAINT "member_lab_door_transaction_id_fkey" FOREIGN KEY ("door_transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_event" ADD CONSTRAINT "member_event_door_transaction_id_fkey" FOREIGN KEY ("door_transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("lab_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_method_id_fkey" FOREIGN KEY ("method_id") REFERENCES "payment_methods"("method_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_payments" ADD CONSTRAINT "member_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("transaction_id") ON DELETE SET NULL ON UPDATE CASCADE;

