-- When a lab or event finishes, as 'HH:MM' like start_time — optional, and
-- only alongside a start time. Shown as a range: '6:00-7:00pm'.
ALTER TABLE "events"
    ADD COLUMN "end_time" VARCHAR(5),
    ADD CONSTRAINT chk_events_end_time_format
        CHECK (end_time IS NULL OR end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "labs"
    ADD COLUMN "end_time" VARCHAR(5),
    ADD CONSTRAINT chk_labs_end_time_format
        CHECK (end_time IS NULL OR end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
