-- "j-board" events: seen by j-board, treasurer and admin — not by officers or
-- members. J-board in turn doesn't see 'officers' events. See eventRoutes.js.
ALTER TYPE "event_track" ADD VALUE 'jboard';
