-- A grant being drafted can be put on the tracker before anyone knows what it
-- will ask for — it's there for its deadline. Once it's sent (under review,
-- awarded, denied) it has to say how much it asked for. chk_grants_amount_
-- requested_positive still holds for any amount that is set; a NULL passes it.
ALTER TABLE "grants" ALTER COLUMN "amount_requested" DROP NOT NULL;

ALTER TABLE "grants"
    ADD CONSTRAINT chk_grants_amount_past_drafting
    CHECK (status = 'drafting' OR amount_requested IS NOT NULL);
