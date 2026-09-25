-- Waitlist offers: someone moved off the waitlist holds a spot as `offered`
-- until they accept the emailed link; offer_sent_at is when it was sent.
ALTER TYPE "attendance_status" ADD VALUE 'offered';
ALTER TABLE "member_lab" ADD COLUMN "offer_sent_at" TIMESTAMPTZ;
ALTER TABLE "member_event" ADD COLUMN "offer_sent_at" TIMESTAMPTZ;
