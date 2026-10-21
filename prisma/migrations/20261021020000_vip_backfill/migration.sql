-- Everyone already marked paid for this school year is a VIP from the start,
-- rather than waiting for the hourly sync to catch them. Only plain members:
-- j-board who've paid stay j-board, and staff don't pay dues at all. Its own
-- migration because Postgres won't use a value an enum gained in the same
-- transaction (see vip_role).
--
-- The year is worked out as schoolYearOf() does in src/dues.js: August starts
-- a new one, written '2026–27' with an en dash.
UPDATE "members" AS m
SET role = 'vip'
WHERE m.role = 'member'
  AND EXISTS (
    SELECT 1 FROM "dues_payments" AS d
    WHERE d.member_id = m.user_id
      AND d.school_year = (
        SELECT start::text || '–' || right((start + 1)::text, 2)
        FROM (SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int
                     - CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 8 THEN 0 ELSE 1 END AS start) AS y
      )
  );
