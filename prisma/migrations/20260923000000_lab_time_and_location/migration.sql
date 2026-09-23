-- The member lab view's header line is "date • time • room", and the time is
-- also what decides when the RSVP view gives way to check-in. Both nullable:
-- a lab with no time counts as started from the beginning of its day.
ALTER TABLE "labs"
    ADD COLUMN "start_time" VARCHAR(5),
    ADD COLUMN "location" TEXT;

-- Same format rule as events.start_time.
ALTER TABLE "labs"
    ADD CONSTRAINT chk_labs_start_time_format
        CHECK (start_time IS NULL OR start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
