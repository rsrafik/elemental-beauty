-- ============================================================
-- A payment due date set by hand on a lab or members-only event,
-- in place of the usual a week before at 11:59 PM. Null keeps
-- the usual one (paymentDue in src/payable.js).
-- ============================================================

ALTER TABLE "labs" ADD COLUMN "payment_due_override" TIMESTAMPTZ;
ALTER TABLE "events" ADD COLUMN "payment_due_override" TIMESTAMPTZ;
