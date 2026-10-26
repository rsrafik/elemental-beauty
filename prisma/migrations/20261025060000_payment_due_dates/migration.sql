-- ============================================================
-- Payment due dates: a lab's or members-only event's entry is due
-- a week before, at 11:59 PM, and anyone still owing with nothing
-- sent in by then is moved to the waitlist (src/payments.js).
-- And "reject" on a payment, which moves them there too, as its
-- own status beside "send back" (rejected).
-- ============================================================

ALTER TYPE "payment_status" ADD VALUE 'declined';

ALTER TABLE "labs" ADD COLUMN "payments_due_swept_at" TIMESTAMPTZ;
ALTER TABLE "events" ADD COLUMN "payments_due_swept_at" TIMESTAMPTZ;

-- Anything already past its due date when this lands counts as done, so
-- nobody already signed up is moved to a waitlist after the fact. Due is
-- the date a week before at 23:59 on the club's clock (src/clubTime.js).
UPDATE "labs" SET "payments_due_swept_at" = now()
WHERE "date" IS NOT NULL
  AND ((("date" - 7) + time '23:59') AT TIME ZONE 'America/Indiana/Indianapolis') < now();
UPDATE "events" SET "payments_due_swept_at" = now()
WHERE ((("date" - 7) + time '23:59') AT TIME ZONE 'America/Indiana/Indianapolis') < now();
