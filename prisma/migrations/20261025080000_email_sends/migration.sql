-- The emails officers send from a button, so each popup can say when it last
-- went out (EmailSend in schema.prisma)

-- CreateEnum
CREATE TYPE "email_send_kind" AS ENUM ('email_all', 'unpaid_reminder', 'confirmation');

-- CreateTable
CREATE TABLE "email_sends" (
    "email_send_id" SERIAL NOT NULL,
    "kind" "email_send_kind" NOT NULL,
    "lab_id" INTEGER,
    "event_id" INTEGER,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMPTZ,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "sent_by" INTEGER,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("email_send_id")
);

-- CreateIndex
CREATE INDEX "email_sends_kind_lab_id_idx" ON "email_sends"("kind", "lab_id");

-- CreateIndex
CREATE INDEX "email_sends_kind_event_id_idx" ON "email_sends"("kind", "event_id");

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_lab_id_fkey" FOREIGN KEY ("lab_id") REFERENCES "labs"("lab_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A confirmation round that went out before this was kept: its time, and the
-- deadline it set (the latest anyone signed up still has)
INSERT INTO "email_sends" ("kind", "lab_id", "sent_at", "deadline")
SELECT 'confirmation', l."lab_id", l."confirm_sent_at", (SELECT max(ml."confirm_by") FROM "member_lab" ml WHERE ml."lab_id" = l."lab_id")
FROM "labs" l WHERE l."confirm_sent_at" IS NOT NULL;
INSERT INTO "email_sends" ("kind", "event_id", "sent_at", "deadline")
SELECT 'confirmation', e."event_id", e."confirm_sent_at", (SELECT max(me."confirm_by") FROM "member_event" me WHERE me."event_id" = e."event_id")
FROM "events" e WHERE e."confirm_sent_at" IS NOT NULL;
