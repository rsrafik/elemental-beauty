-- The lesson tab's PDF, stored with the lab it belongs to.
ALTER TABLE "labs"
    ADD COLUMN "lesson_pdf" BYTEA,
    ADD COLUMN "lesson_pdf_name" TEXT;
