-- "Confirmation": a round of emails asking everyone signed up to confirm
-- their spot, with the lab's prelab PDF attached.
ALTER TABLE "labs"
    ADD COLUMN "prelab_pdf" BYTEA,
    ADD COLUMN "prelab_pdf_name" TEXT,
    ADD COLUMN "confirm_sent_at" TIMESTAMPTZ;
ALTER TABLE "events" ADD COLUMN "confirm_sent_at" TIMESTAMPTZ;
ALTER TABLE "member_lab"
    ADD COLUMN "confirm_sent_at" TIMESTAMPTZ,
    ADD COLUMN "confirmed_at" TIMESTAMPTZ;
ALTER TABLE "member_event"
    ADD COLUMN "confirm_sent_at" TIMESTAMPTZ,
    ADD COLUMN "confirmed_at" TIMESTAMPTZ;
