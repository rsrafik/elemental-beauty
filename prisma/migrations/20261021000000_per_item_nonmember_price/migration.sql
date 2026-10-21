-- ============================================================
-- The non-member price moves off the year and onto each lab and
-- event, set where the lab or event is made and edited.
-- ============================================================

-- What someone who hasn't paid dues is charged at the door for this one.
-- 0 = nothing extra. Only a members-only event asks (asksDues in
-- src/dues.js), but every event has the column so moving one between
-- tracks doesn't need it to appear and disappear.
ALTER TABLE "labs"
    ADD COLUMN "nonmember_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_labs_nonmember_price CHECK (nonmember_price >= 0);

ALTER TABLE "events"
    ADD COLUMN "nonmember_price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_events_nonmember_price CHECK (nonmember_price >= 0);

-- ---------- backfill ----------
--
-- Whatever the year's price was is what each lab and members-only event in
-- that year now says, so nothing anyone's charged changes on the day this
-- lands. The year is worked out the same way schoolYearOf() does in
-- src/dues.js: August starts a new one, written '2025–26' with an en dash.
-- A lab with no date yet (a draft) takes this year's, which is the year the
-- door would have charged it under too.
CREATE FUNCTION pg_temp.school_year_of(day DATE) RETURNS TEXT AS $$
    SELECT start::text || '–' || right((start + 1)::text, 2)
    FROM (SELECT EXTRACT(YEAR FROM day)::int - CASE WHEN EXTRACT(MONTH FROM day) >= 8 THEN 0 ELSE 1 END AS start) AS y
$$ LANGUAGE sql IMMUTABLE;

UPDATE "labs" AS l
SET nonmember_price = t.nonmember_price
FROM "year_targets" AS t
WHERE t.school_year = pg_temp.school_year_of(COALESCE(l.date, CURRENT_DATE))
  AND t.nonmember_price > 0;

UPDATE "events" AS e
SET nonmember_price = t.nonmember_price
FROM "year_targets" AS t
WHERE e.track = 'members'
  AND t.school_year = pg_temp.school_year_of(e.date)
  AND t.nonmember_price > 0;

-- ...and the year's copy goes, so there's only ever one place it's set.
ALTER TABLE "year_targets"
    DROP CONSTRAINT chk_year_targets_nonmember_price,
    DROP COLUMN "nonmember_price";
