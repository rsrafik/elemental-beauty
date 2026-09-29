-- Whether a lab is taking sign-ups. Off, it still shows for members but
-- without the rsvp button, and new RSVPs are refused (see labRoutes.js);
-- anyone already on it can still cancel, or take an offered spot. Switched
-- from the lab's dots menu by an officer, the treasurer or an admin.
ALTER TABLE "labs" ADD COLUMN "accepting_rsvps" BOOLEAN NOT NULL DEFAULT true;
