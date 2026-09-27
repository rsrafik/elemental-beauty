-- "EB board" events: seen by j-board and the rest of the board (officer,
-- treasurer, admin), never by a plain member — see eventRoutes.js.
ALTER TYPE "event_track" ADD VALUE 'board';
