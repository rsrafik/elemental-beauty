-- ============================================================
-- Hand-written: move the ledger write from 'approved' to
-- 'reimbursed'.
--
-- Its own migration rather than part of the one before it
-- because that one is where 'reimbursed' was added to the enum,
-- and Postgres won't let a new enum value be used in the same
-- transaction that adds it.
--
-- Why the move: approving a receipt says the club agrees it owes
-- the money. Reimbursing says it's been handed over. Only the
-- second one is money leaving, so only the second one is a line
-- of spending — which is exactly what /analytics does when the
-- treasurer presses "reimburse".
--
-- Two other things change with it:
--
--   the date    the expense is dated the day of the purchase,
--               not the day it was settled, so the spending
--               lands in the month the club actually incurred it
--   the source  the receipt now carries its own title, so the
--               ledger row can be called what the officer called
--               it instead of a generated string
-- ============================================================

DROP TRIGGER IF EXISTS trg_reimbursement_approved ON "reimbursements";

CREATE OR REPLACE FUNCTION fn_reimbursement_to_transaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'reimbursed' AND OLD.status IS DISTINCT FROM 'reimbursed' THEN
        INSERT INTO "transactions" (type, source, amount, category, date, reimbursement_id)
        VALUES (
            'expense',
            NEW.title,
            NEW.amount_requested,
            NEW.category,
            NEW.date,
            NEW.reimbursement_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fires only on the transition into 'reimbursed', so re-saving an already
-- settled row can never create a duplicate ledger entry. The application
-- deliberately contains NO ledger-writing code for payouts — this is it.
CREATE TRIGGER trg_reimbursement_reimbursed
AFTER UPDATE ON "reimbursements"
FOR EACH ROW
EXECUTE FUNCTION fn_reimbursement_to_transaction();
