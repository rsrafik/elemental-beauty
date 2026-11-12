-- What the landing page shows in place of its placeholders: the people, the
-- album's cards, and the sponsors (whose rows also carry the sponsor
-- requests the admin sponsors page will keep). Additive only.
CREATE TYPE "SponsorStatus" AS ENUM ('pending', 'contacting', 'active', 'archive');
CREATE TYPE "SponsorSource" AS ENUM ('form', 'manual');
CREATE TYPE "SponsorOffer" AS ENUM ('products', 'money', 'other');

CREATE TABLE "landing_people" (
    "person_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "image" TEXT,
    "image_key" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_people_pkey" PRIMARY KEY ("person_id")
);

CREATE TABLE "album_cards" (
    "card_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE,
    "description" TEXT,
    "image" TEXT NOT NULL,
    "image_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_cards_pkey" PRIMARY KEY ("card_id")
);

CREATE TABLE "sponsors" (
    "sponsor_id" SERIAL NOT NULL,
    "company_name" TEXT,
    "contact_name" TEXT,
    "contact_info" TEXT,
    "offers" "SponsorOffer"[] DEFAULT ARRAY[]::"SponsorOffer"[],
    "offer_other" TEXT,
    "details" TEXT,
    "status" "SponsorStatus" NOT NULL DEFAULT 'pending',
    "source" "SponsorSource" NOT NULL DEFAULT 'manual',
    "landing_title" TEXT,
    "website" TEXT,
    "image" TEXT,
    "image_key" TEXT,
    "on_landing" BOOLEAN NOT NULL DEFAULT false,
    "landing_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("sponsor_id")
);

CREATE INDEX "sponsors_status_idx" ON "sponsors"("status");
