-- Owing for a lab or event after its payment due date: 48 hours to pay, and a
-- reminder a day (src/payments.js)
ALTER TABLE "member_lab" ADD COLUMN "pay_by" TIMESTAMPTZ, ADD COLUMN "pay_reminded_at" TIMESTAMPTZ;
ALTER TABLE "member_event" ADD COLUMN "pay_by" TIMESTAMPTZ, ADD COLUMN "pay_reminded_at" TIMESTAMPTZ;
