-- ============================================================
-- Finance categories become a table the treasurer edits from
-- /analytics, instead of an enum only a migration could change.
-- ============================================================

CREATE TABLE "finance_categories" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "transaction_type" NOT NULL,
    "color" TEXT NOT NULL,
    "position" SERIAL NOT NULL,

    CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("key")
);

-- The nine the enum had, in the order the donuts draw them and with the
-- labels and colours the pages used to keep for themselves
-- (frontend/lib/finances.js).
INSERT INTO "finance_categories" ("key", "label", "type", "color") VALUES
    ('grants',      'grants',      'income',  '#A7CC70'),
    ('fundraisers', 'fundraisers', 'income',  '#FFDF2B'),
    ('dues',        'dues',        'income',  '#FF8A78'),
    ('fees',        'entry fees',  'income',  '#B07CE8'),
    ('sponsors',    'sponsors',    'income',  '#3990FA'),
    ('lab',         'lab',         'expense', '#FF7D45'),
    ('events',      'events',      'expense', '#E35944'),
    ('guests',      'guests',      'expense', '#FFDF2B'),
    ('marketing',   'marketing',   'expense', '#4066FF');

-- Every row keeps what it was filed under: the enum's label is the new key.
-- The triggers that write ledger rows (a settled receipt, an awarded grant)
-- insert the same words they always did, which are now checked against the
-- table instead of the enum.
ALTER TABLE "reimbursements" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
ALTER TABLE "transactions" ALTER COLUMN "category" TYPE TEXT USING "category"::text;

DROP TYPE "finance_category";

-- RESTRICT: a category can't be removed while anything is filed under it,
-- or that money would drop out of both summaries without a trace.
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_category_fkey" FOREIGN KEY ("category") REFERENCES "finance_categories"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_fkey" FOREIGN KEY ("category") REFERENCES "finance_categories"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
