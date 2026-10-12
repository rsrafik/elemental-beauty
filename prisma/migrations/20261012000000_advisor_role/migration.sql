-- The faculty advisor: sees everything an admin does, changes nothing but
-- the club-wide email. See src/middleware/advisor.js.
ALTER TYPE "member_role" ADD VALUE 'advisor';
