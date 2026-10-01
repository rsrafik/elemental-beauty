-- The check-in page's "start check-in": opens a lab's or event's door before
-- its start time, so people signed up get their QR code on its page early
-- (it opens on its own at the start time either way).
ALTER TABLE "labs" ADD COLUMN "checkin_open" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "checkin_open" BOOLEAN NOT NULL DEFAULT false;
