-- ============================================================
-- How someone who owes dues got into one lab or members-only
-- event: the non-member price for it, or waived that once. Kept
-- on their row so it can be settled ahead of time (the $ on the
-- check-in page) and checking in doesn't ask again.
-- ============================================================

CREATE TYPE "door_payment" AS ENUM ('fee', 'waive');

ALTER TABLE "member_lab" ADD COLUMN "door_payment" "door_payment";
ALTER TABLE "member_event" ADD COLUMN "door_payment" "door_payment";
