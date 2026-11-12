-- Feedback forms for labs and events (src/feedback.js): one row per member per
-- lab/event, the check-in page's "release feedback form" switch, and when the
-- site last asked each attendee whether they'd give some.
ALTER TABLE "labs" ADD COLUMN "feedback_released" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "events" ADD COLUMN "feedback_released" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "member_lab" ADD COLUMN "feedback_asked_at" TIMESTAMPTZ;
ALTER TABLE "member_event" ADD COLUMN "feedback_asked_at" TIMESTAMPTZ;

CREATE TABLE "lab_feedback" (
    "member_id" INTEGER NOT NULL,
    "lab_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_feedback_pkey" PRIMARY KEY ("member_id", "lab_id"),
    CONSTRAINT "lab_feedback_body_check" CHECK (length(btrim("body")) > 0)
);
CREATE INDEX "lab_feedback_lab_id_idx" ON "lab_feedback"("lab_id");
ALTER TABLE "lab_feedback" ADD CONSTRAINT "lab_feedback_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "lab_feedback" ADD CONSTRAINT "lab_feedback_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("lab_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "event_feedback" (
    "member_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_feedback_pkey" PRIMARY KEY ("member_id", "event_id"),
    CONSTRAINT "event_feedback_body_check" CHECK (length(btrim("body")) > 0)
);
CREATE INDEX "event_feedback_event_id_idx" ON "event_feedback"("event_id");
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;
