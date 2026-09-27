-- ============================================================
-- Non-member prices, event links, reimbursement payouts, and
-- awarded grants writing their own income row.
-- ============================================================

-- Lab and event emails aren't optional any more: they're how someone finds
-- out their spot is theirs, and where to be. Only the club-wide switch stays.
ALTER TABLE "users" DROP COLUMN "email_events";

-- Links an event's page lists under its photo: [{ title, url }, ...].
ALTER TABLE "events" ADD COLUMN "links" JSONB;

-- What someone who hasn't paid dues is charged at the door for a lab or a
-- members-only event, per school year. 0 = not set.
ALTER TABLE "year_targets"
    ADD COLUMN "nonmember_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_year_targets_nonmember_price CHECK (nonmember_price >= 0);

-- That door charge, as income. Its own slice rather than 'dues': it covers
-- one lab or event, not the year.
ALTER TYPE "finance_category" ADD VALUE 'fees';

-- Where to send the money back: the platform, and the phone number, email
-- or username on it. Null on requests filed before this was asked.
ALTER TABLE "reimbursements"
    ADD COLUMN "payout_method" TEXT,
    ADD COLUMN "payout_handle" TEXT;

-- ---------- awarded grants are income ----------
--
-- Marking a grant awarded puts it in the income ledger under 'grants', linked
-- by grant_id, for what was granted (what was asked for until that's known),
-- dated the day it was granted. The same rule as a reimbursement: the app has
-- no code that writes this row — these triggers are it.
--
--   awarded            a new income row
--   still awarded,     the row follows the grant's amount, name and date —
--   something changed  only then, so a hand-corrected row isn't overwritten
--                      by an unrelated edit
--   no longer awarded  the row goes
--   grant deleted      the row goes first, so the foreign key doesn't refuse
--                      (spending linked to the grant still does)
--
-- A row the treasurer deletes from the ledger stays deleted until the grant
-- is next moved into 'awarded'.

-- the date it was granted, filled in when a grant is awarded without one
CREATE OR REPLACE FUNCTION fn_grant_awarded_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'awarded' AND NEW.date_granted IS NULL THEN
        NEW.date_granted := CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_grant_awarded_date
BEFORE INSERT OR UPDATE ON "grants"
FOR EACH ROW
EXECUTE FUNCTION fn_grant_awarded_date();

CREATE OR REPLACE FUNCTION fn_grant_to_transaction()
RETURNS TRIGGER AS $$
DECLARE
    was_awarded BOOLEAN := TG_OP = 'UPDATE' AND OLD.status = 'awarded';
BEGIN
    IF NEW.status = 'awarded' AND NOT was_awarded THEN
        INSERT INTO "transactions" (type, source, amount, category, date, grant_id)
        VALUES (
            'income',
            NEW.name,
            COALESCE(NEW.amount_awarded, NEW.amount_requested),
            'grants',
            NEW.date_granted,
            NEW.grant_id
        );
    ELSIF NEW.status = 'awarded' AND (
        NEW.name IS DISTINCT FROM OLD.name OR
        COALESCE(NEW.amount_awarded, NEW.amount_requested) IS DISTINCT FROM COALESCE(OLD.amount_awarded, OLD.amount_requested) OR
        NEW.date_granted IS DISTINCT FROM OLD.date_granted
    ) THEN
        UPDATE "transactions"
        SET source = NEW.name,
            amount = COALESCE(NEW.amount_awarded, NEW.amount_requested),
            date = NEW.date_granted
        WHERE grant_id = NEW.grant_id AND type = 'income';
    ELSIF NEW.status <> 'awarded' AND was_awarded THEN
        DELETE FROM "transactions" WHERE grant_id = NEW.grant_id AND type = 'income';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_grant_awarded
AFTER INSERT OR UPDATE ON "grants"
FOR EACH ROW
EXECUTE FUNCTION fn_grant_to_transaction();

CREATE OR REPLACE FUNCTION fn_grant_deleted()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM "transactions" WHERE grant_id = OLD.grant_id AND type = 'income';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_grant_deleted
BEFORE DELETE ON "grants"
FOR EACH ROW
EXECUTE FUNCTION fn_grant_deleted();
