-- A j-board member can be on several teams at once, not just one: the single
-- jboard_team becomes the list jboard_teams (empty for everyone else, and for
-- a j-board member not yet on a team). They see the j-board events of every
-- team they're on, plus the ones for all of j-board (see eventRoutes.js).
ALTER TABLE "members" ADD COLUMN "jboard_teams" "event_team"[] NOT NULL DEFAULT '{}';
UPDATE "members" SET "jboard_teams" = ARRAY["jboard_team"] WHERE "jboard_team" IS NOT NULL;
ALTER TABLE "members" DROP COLUMN "jboard_team";
