-- J-board: a staff role between officer and treasurer, given by an admin.
ALTER TYPE "member_role" ADD VALUE 'jboard' AFTER 'officer';

-- Email preferences become a choice or no choice: null follows the role —
-- members opted in, staff opted out until they opt in. Nobody had chosen
-- anything yet (everyone was on the old default), so everyone starts at null.
ALTER TABLE "users"
    ALTER COLUMN "email_club" DROP NOT NULL,
    ALTER COLUMN "email_club" DROP DEFAULT,
    ALTER COLUMN "email_events" DROP NOT NULL,
    ALTER COLUMN "email_events" DROP DEFAULT;
UPDATE "users" SET "email_club" = NULL, "email_events" = NULL;
