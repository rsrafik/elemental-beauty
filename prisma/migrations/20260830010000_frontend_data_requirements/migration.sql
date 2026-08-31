-- ============================================================
-- Everything the pages ask for that the schema had nowhere to
-- put it. Hand-written rather than generated, because three of
-- these are conversions of existing columns rather than new
-- ones, and the data in them has to be carried across.
--
--   names            first/last on users
--   instagram        moved off members onto users
--   profile picture  moved off members onto users
--   announcements    a new table
--   event tags       a new table (officers edit the list)
--   event track      who an event is for
--   event time       start time
--   grants           name / org / status / deadline
--   receipts         title, previous denial, 'reimbursed'
--   categories       the finance enum, re-cut to the donuts
--   targets          income goal + expense budget per year
-- ============================================================


-- ============================================================
-- Names, instagram and the profile picture
-- ============================================================
-- The roster, the leaderboard, the Elementist pass and every receipt's "who"
-- are a person's name, and nothing derived one from the username.
--
-- Instagram and the picture move up from members to users because both are set
-- before a membership exists: sign-up asks for the instagram handle, and
-- /account shows the photo picker to somebody with an account and no member row.

ALTER TABLE "users"
    ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "instagram" TEXT,
    ADD COLUMN "profile_picture" TEXT;

-- carry across whatever the member rows were already holding
UPDATE "users" u
SET "instagram" = m."instagram",
    "profile_picture" = m."profile_picture"
FROM "members" m
WHERE m."user_id" = u."user_id";

-- The default stays: signing yourself up asks for a username and a password and
-- nothing else, so an account can exist before anyone has said what to call it.
-- Empty rather than null because every page that draws a name copes with a blank
-- one and would throw on a null. /account and /students both refuse to save one.

ALTER TABLE "members"
    DROP COLUMN "instagram",
    DROP COLUMN "profile_picture";

CREATE INDEX "users_last_name_first_name_idx" ON "users"("last_name", "first_name");


-- ============================================================
-- Announcements
-- ============================================================
-- The officer dashboard posts them; the member dashboard shows them.

CREATE TABLE "announcements" (
    "announcement_id" SERIAL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "author_id" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_author_id_fkey"
        FOREIGN KEY ("author_id") REFERENCES "users"("user_id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "announcements_created_at_idx" ON "announcements"("created_at");

ALTER TABLE "announcements"
    ADD CONSTRAINT chk_announcement_body_not_blank CHECK (btrim(body) <> '');


-- ============================================================
-- Event tags, track and start time
-- ============================================================
-- The tag list is a table rather than an enum because officers add to it and
-- remove from it on the calendar page. 'Lab' is not one of them: labs carry
-- sign-ups, a quiz and check-in, so they are their own table.

CREATE TABLE "event_categories" (
    "category_id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL
);

CREATE UNIQUE INDEX "event_categories_name_key" ON "event_categories"("name");

INSERT INTO "event_categories" ("name") VALUES
    ('GBM'),
    ('Workshop'),
    ('Social'),
    ('Pop-Up'),
    ('Fundraiser'),
    ('Volunteering'),
    ('Photoshoot'),
    ('Deadline');

CREATE TYPE "event_track" AS ENUM ('members', 'officers', 'open', 'online');

ALTER TABLE "events"
    ADD COLUMN "track" "event_track" NOT NULL DEFAULT 'members',
    ADD COLUMN "category_id" INTEGER,
    ADD COLUMN "start_time" VARCHAR(5);

ALTER TABLE "events"
    ADD CONSTRAINT "events_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "event_categories"("category_id")
        ON DELETE SET NULL ON UPDATE CASCADE;

-- 'HH:MM', which is what <input type="time"> hands back and what the calendar
-- prints. Null for something with no clock time on it — a deadline, say.
ALTER TABLE "events"
    ADD CONSTRAINT chk_events_start_time_format
        CHECK (start_time IS NULL OR start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

CREATE INDEX "events_date_idx" ON "events"("date");
CREATE INDEX "events_category_id_idx" ON "events"("category_id");


-- ============================================================
-- Grants
-- ============================================================
-- Tracked from before the application is sent, so the amount is what was asked
-- for and the status is what says whether the club ever saw it. A drafting
-- application hasn't been granted anything yet, which is why date_granted has
-- to be allowed to be null.

CREATE TYPE "grant_status" AS ENUM ('drafting', 'under_review', 'awarded', 'denied');

ALTER TABLE "grants" RENAME COLUMN "source" TO "org";
ALTER TABLE "grants" RENAME COLUMN "amount_granted" TO "amount_requested";
ALTER TABLE "grants" RENAME CONSTRAINT chk_grants_amount_positive TO chk_grants_amount_requested_positive;

ALTER TABLE "grants"
    ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "status" "grant_status" NOT NULL DEFAULT 'drafting',
    ADD COLUMN "deadline" DATE;

-- Anything already on file was banked, so it was awarded; the fund it came from
-- is the best name available for it, and the day it landed is the only date
-- there is to stand in for the deadline.
UPDATE "grants"
SET "name" = "org",
    "status" = 'awarded',
    "deadline" = "date_granted";

ALTER TABLE "grants"
    ALTER COLUMN "name" DROP DEFAULT,
    ALTER COLUMN "deadline" SET NOT NULL,
    ALTER COLUMN "date_granted" DROP NOT NULL;

CREATE INDEX "grants_status_idx" ON "grants"("status");


-- ============================================================
-- Receipts
-- ============================================================
-- 'reimbursed' is the status the ledger row hangs off (see the trigger at the
-- bottom of this file): agreeing the club owes the money and actually handing
-- it back are two different days, and only the second one is spending.
--
-- The value is added here and used nowhere else in this migration on purpose —
-- Postgres won't let a new enum value be used in the transaction that adds it.

ALTER TYPE "reimbursement_status" ADD VALUE 'reimbursed' AFTER 'approved';

-- The form asks for both: the title is what the row is called everywhere it's
-- listed, the explanation is what it was bought for.
ALTER TABLE "reimbursements"
    ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "previous_denial" TEXT;

-- existing rows only ever had the one field, so it has to serve as both
UPDATE "reimbursements" SET "title" = left("explanation", 80);

ALTER TABLE "reimbursements" ALTER COLUMN "title" DROP DEFAULT;


-- ============================================================
-- Finance categories
-- ============================================================
-- Re-cut to the eight the analytics pages actually slice by: four that make up
-- the income donut, four that make up the expense donut — and those same four
-- are what a receipt gets filed under.
--
-- Recreated rather than altered, because the old values have to go and Postgres
-- has no DROP VALUE. Every existing row is mapped onto its nearest new slice;
-- 'other' has no equivalent, so it lands on the general slice for whichever
-- side of the ledger it was on.

CREATE TYPE "finance_category_new" AS ENUM (
    'grants', 'fundraisers', 'dues', 'sponsors',
    'lab', 'events', 'guests', 'marketing'
);

ALTER TABLE "transactions"
    ALTER COLUMN "category" TYPE "finance_category_new"
    USING (
        CASE "category"::text
            WHEN 'membership_dues' THEN 'dues'
            WHEN 'sponsorship'     THEN 'sponsors'
            WHEN 'grant_funding'   THEN 'grants'
            WHEN 'fundraising'     THEN 'fundraisers'
            WHEN 'supplies'        THEN 'lab'
            WHEN 'equipment'       THEN 'lab'
            WHEN 'venue'           THEN 'events'
            WHEN 'event_costs'     THEN 'events'
            WHEN 'travel'          THEN 'guests'
            WHEN 'marketing'       THEN 'marketing'
            ELSE CASE WHEN "type" = 'income' THEN 'fundraisers' ELSE 'events' END
        END
    )::"finance_category_new";

-- a receipt is always an expense, so 'other' can only land on the expense side
ALTER TABLE "reimbursements"
    ALTER COLUMN "category" TYPE "finance_category_new"
    USING (
        CASE "category"::text
            WHEN 'supplies'    THEN 'lab'
            WHEN 'equipment'   THEN 'lab'
            WHEN 'venue'       THEN 'events'
            WHEN 'event_costs' THEN 'events'
            WHEN 'travel'      THEN 'guests'
            WHEN 'marketing'   THEN 'marketing'
            ELSE 'events'
        END
    )::"finance_category_new";

DROP TYPE "finance_category";
ALTER TYPE "finance_category_new" RENAME TO "finance_category";


-- ============================================================
-- Year targets
-- ============================================================
-- The income goal and the spending budget, edited in place on the two summary
-- cards. One row per school year ('2025–26'), because a fresh pair is set every
-- august and last year's figures stay on last year's view.

CREATE TABLE "year_targets" (
    "school_year" TEXT PRIMARY KEY,
    "income_goal" DECIMAL(10,2) NOT NULL,
    "expense_budget" DECIMAL(10,2) NOT NULL,

    CONSTRAINT chk_year_targets_positive
        CHECK (income_goal >= 0 AND expense_budget >= 0)
);
