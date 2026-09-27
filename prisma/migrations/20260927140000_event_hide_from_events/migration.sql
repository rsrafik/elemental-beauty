-- The event editor's "hide from events" switch: on, and the event is left off
-- both /events pages but stays on the calendar.
ALTER TABLE "events" ADD COLUMN "hide_from_events" BOOLEAN NOT NULL DEFAULT false;
