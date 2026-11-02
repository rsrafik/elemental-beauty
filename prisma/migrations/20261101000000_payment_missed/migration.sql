-- Past a payment due date, someone only loses their spot when the waitlist
-- needs it: when they first went overdue, kept while they wait or on the
-- waitlist if they were moved (src/payments.js)
ALTER TABLE "member_lab" ADD COLUMN "payment_missed_at" TIMESTAMPTZ;
ALTER TABLE "member_event" ADD COLUMN "payment_missed_at" TIMESTAMPTZ;
