-- Which j-board team a j-board event is for. Only a j-board event has one —
-- it stands in for the seat cap on the form, which j-board events don't use.
CREATE TYPE "event_team" AS ENUM ('communication', 'secretary', 'treasury', 'formula', 'social_media');

ALTER TABLE "events" ADD COLUMN "team" "event_team";
