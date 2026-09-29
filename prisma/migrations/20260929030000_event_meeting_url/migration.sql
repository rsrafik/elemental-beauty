-- The link an online event is held at (a Zoom or Meet address): the calendar
-- shows an "enter meeting" button for it. Only an online event keeps one —
-- moving it to another track clears it (see eventRoutes.js).
ALTER TABLE "events" ADD COLUMN "meeting_url" TEXT;
