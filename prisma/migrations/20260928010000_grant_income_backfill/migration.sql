-- ============================================================
-- Every awarded grant gets its income row — the ones awarded
-- before the grant triggers existed too.
--
-- Most of those already had their deposit typed into the income
-- ledger by hand, with nothing tying it to the grant. So rather
-- than write a second row, each awarded grant first looks for
-- that deposit: an unlinked 'grants' income row for the same
-- amount, on the day it was granted or naming the grant. Found,
-- it's linked (and called what the grant is called, as the
-- trigger would); not found, the row is written fresh.
--
-- From here the two are one thing: the row follows the grant (the
-- triggers), and the ledger won't edit or delete it on its own
-- (transactionRoutes.js) — the grant tracker is where it changes.
-- ============================================================

-- an awarded grant with no date gets today's, as the trigger does now
UPDATE "grants" SET date_granted = CURRENT_DATE
WHERE status = 'awarded' AND date_granted IS NULL;

DO $$
DECLARE
    g RECORD;
    found_id INTEGER;
BEGIN
    FOR g IN
        SELECT * FROM "grants"
        WHERE status = 'awarded'
          AND NOT EXISTS (
              SELECT 1 FROM "transactions" t
              WHERE t.grant_id = "grants".grant_id AND t.type = 'income'
          )
        ORDER BY grant_id
    LOOP
        SELECT transaction_id INTO found_id
        FROM "transactions"
        WHERE type = 'income'
          AND category = 'grants'
          AND grant_id IS NULL
          AND amount = COALESCE(g.amount_awarded, g.amount_requested)
          AND (date = g.date_granted OR source ILIKE '%' || g.name || '%')
        ORDER BY (date = g.date_granted) DESC, transaction_id
        LIMIT 1;

        IF found_id IS NOT NULL THEN
            UPDATE "transactions" SET grant_id = g.grant_id, source = g.name
            WHERE transaction_id = found_id;
        ELSE
            INSERT INTO "transactions" (type, source, amount, category, date, grant_id)
            VALUES ('income', g.name, COALESCE(g.amount_awarded, g.amount_requested), 'grants', g.date_granted, g.grant_id);
        END IF;
    END LOOP;
END $$;
