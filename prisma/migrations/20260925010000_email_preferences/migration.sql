-- Opt-outs for officers' "email all" buttons, set from /account. Everyone
-- starts opted in, as they effectively were.
ALTER TABLE "users"
    ADD COLUMN "email_club" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "email_events" BOOLEAN NOT NULL DEFAULT true;
