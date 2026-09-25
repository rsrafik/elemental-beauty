-- The deadline an officer sets on a confirmation round.
ALTER TABLE "member_lab" ADD COLUMN "confirm_by" TIMESTAMPTZ;
ALTER TABLE "member_event" ADD COLUMN "confirm_by" TIMESTAMPTZ;
