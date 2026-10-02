-- The one-time point awards a member has had — following on instagram,
-- joining the discord (ONE_TIME_ACTIONS in src/points.js). Each can be given
-- once, and taken back from the same button (see memberRoutes.js).
ALTER TABLE "members" ADD COLUMN "awards_claimed" TEXT[] NOT NULL DEFAULT '{}';

-- whoever already got one before this was kept has it marked, from the log
UPDATE "members" m
SET "awards_claimed" = given.reasons
FROM (
    SELECT target_id, array_agg(DISTINCT details->>'reason') AS reasons
    FROM "activity_log"
    WHERE action = 'points_awarded'
      AND details->>'reason' IN ('instagram_follow', 'discord_join')
    GROUP BY target_id
) given
WHERE m.user_id = given.target_id;
