-- "subscribe" on /calendar: the tracks a member picked for their calendar feed,
-- and whether they've exported it (src/routes/calendarRoutes.js)
ALTER TABLE "members" ADD COLUMN "calendar_tracks" "event_track"[] DEFAULT ARRAY[]::"event_track"[];
ALTER TABLE "members" ADD COLUMN "calendar_subscribed" BOOLEAN NOT NULL DEFAULT false;
