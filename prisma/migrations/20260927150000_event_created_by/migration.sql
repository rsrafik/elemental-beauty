-- Who added each event. A j-board event added by an officer, treasurer or
-- admin is read-only to j-board (see eventRoutes.js). Existing events have no
-- creator on record, so they stay editable.
ALTER TABLE "events" ADD COLUMN "created_by" INTEGER;

ALTER TABLE "events"
    ADD CONSTRAINT "events_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE;
