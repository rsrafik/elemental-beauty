-- A person on the landing page can link to a page of their own: clicking
-- their name or portrait on the rail opens it in a new tab.
ALTER TABLE "landing_people" ADD COLUMN "website" TEXT;
