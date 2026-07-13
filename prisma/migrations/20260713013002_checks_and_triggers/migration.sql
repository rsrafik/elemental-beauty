-- ============================================================
-- Hand-written migration: CHECK constraints + triggers.
-- None of this is expressible in schema.prisma — do not let a
-- schema reset drop it silently.
-- ============================================================

-- ---------- CHECK constraints ----------

ALTER TABLE "grants"
    ADD CONSTRAINT chk_grants_amount_positive CHECK (amount_granted > 0),
    ADD CONSTRAINT chk_grants_expiration CHECK (expiration_date IS NULL OR expiration_date >= date_granted);

ALTER TABLE "reimbursements"
    ADD CONSTRAINT chk_reimb_amount_positive CHECK (amount_requested > 0),
    ADD CONSTRAINT chk_reimb_denial_explained CHECK (status <> 'denied' OR denial_explanation IS NOT NULL);

ALTER TABLE "transactions"
    ADD CONSTRAINT chk_txn_amount_positive CHECK (amount > 0);

ALTER TABLE "labs"
    ADD CONSTRAINT chk_labs_capacity_positive CHECK (capacity > 0);

-- ---------- Quiz: every question must keep at least one correct option ----------
-- A per-row CHECK can't see other rows, so this is a trigger that re-checks
-- the affected question after any insert/update/delete on the options table.
-- The EXISTS guard on the question itself is what lets cascade-deletes of a
-- question (or a whole lab) succeed — without it, deleting the options along
-- with their question would always fail at commit.

CREATE OR REPLACE FUNCTION fn_check_question_has_correct_option()
RETURNS TRIGGER AS $$
DECLARE
    affected_question_id INT := COALESCE(NEW.question_id, OLD.question_id);
BEGIN
    IF EXISTS (
        SELECT 1 FROM "lab_quiz_questions"
        WHERE question_id = affected_question_id
    )
    AND NOT EXISTS (
        SELECT 1 FROM "quiz_answer_options"
        WHERE question_id = affected_question_id AND is_correct = TRUE
    ) THEN
        RAISE EXCEPTION 'Question % must have at least one correct option', affected_question_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Deferred: fires at transaction COMMIT, so the app can insert a question and
-- its options one row at a time inside a single transaction (prisma.$transaction)
-- without tripping the check before the correct option lands.
CREATE CONSTRAINT TRIGGER trg_question_has_correct_option
AFTER INSERT OR UPDATE OR DELETE ON "quiz_answer_options"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION fn_check_question_has_correct_option();

-- ---------- Reimbursements: auto-insert a ledger transaction on approval ----------
-- Fires only on the pending -> approved transition, so re-saving an already
-- approved row can never create duplicate ledger entries. The application
-- deliberately contains NO ledger-writing code for approvals — this is it.

CREATE OR REPLACE FUNCTION fn_reimbursement_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
        INSERT INTO "transactions" (type, source, amount, category, date, reimbursement_id)
        VALUES (
            'expense',
            'Reimbursement #' || NEW.reimbursement_id || ' - ' || NEW.explanation,
            NEW.amount_requested,
            NEW.category,
            CURRENT_DATE,
            NEW.reimbursement_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reimbursement_approved
AFTER UPDATE ON "reimbursements"
FOR EACH ROW
EXECUTE FUNCTION fn_reimbursement_to_transaction();
