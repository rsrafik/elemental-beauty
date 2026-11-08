-- Events can be saved as drafts, the way labs are: one never published is
-- kept off every member's page, and edits saved as a draft on a live one wait
-- in `draft` until they're published or discarded. Every existing event was
-- live, hence the default.
ALTER TABLE "events" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "events" ADD COLUMN "draft" JSONB;
