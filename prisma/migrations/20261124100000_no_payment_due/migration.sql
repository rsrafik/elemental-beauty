-- "no due date" on the check-in page's payments popup: payment for that lab
-- or event isn't due by any day, so nobody loses their spot over it — a
-- payment sent back gets no 48 hours to fix, and one rejected doesn't move
-- them to the waitlist.
ALTER TABLE "labs" ADD COLUMN "no_payment_due" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "no_payment_due" BOOLEAN NOT NULL DEFAULT false;
