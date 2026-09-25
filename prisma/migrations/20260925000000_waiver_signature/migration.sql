-- What a member typed to sign the waiver, and when.
ALTER TABLE "users"
    ADD COLUMN "waiver_name" TEXT,
    ADD COLUMN "waiver_signed_at" TIMESTAMPTZ;
