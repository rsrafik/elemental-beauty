-- A lab's seat count becomes optional (null = unlimited), like an event's.
-- chk_labs_capacity_positive still holds for any number that is set.
ALTER TABLE "labs"
    ALTER COLUMN "capacity" DROP NOT NULL,
    ALTER COLUMN "capacity" DROP DEFAULT;

-- Drafts: an unpublished lab is hidden from members; a live lab's pending
-- edits and a quiz's pending questions wait as JSON until published.
ALTER TABLE "labs"
    ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "draft" JSONB,
    ADD COLUMN "quiz_draft" JSONB;
