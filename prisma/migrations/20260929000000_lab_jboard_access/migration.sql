-- Whether j-board may edit a lab — its details, lesson and quiz. Switched on
-- per lab by an officer, the treasurer or an admin from the lab's dots menu;
-- off, j-board just runs its door and signs up for it (see labRoutes.js).
ALTER TABLE "labs" ADD COLUMN "jboard_can_edit" BOOLEAN NOT NULL DEFAULT false;
