-- Which j-board team a j-board member is on, set by an admin from /students.
-- It decides which j-board events they see: their own team's and the ones for
-- all of j-board (see eventRoutes.js). Null for everyone else, and for a
-- j-board member not yet put on a team.
ALTER TABLE "members" ADD COLUMN "jboard_team" "event_team";
