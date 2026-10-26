-- Goggles rented for a lab: a payment of its own kind, its price kept in one
-- row of club settings, and an income category it's filed under once approved
-- (locked: the app files it there itself — LOCKED in src/financeCategories.js)

-- AlterEnum
ALTER TYPE "payment_kind" ADD VALUE 'goggles';

-- CreateTable
CREATE TABLE "club_settings" (
    "setting_id" INTEGER NOT NULL DEFAULT 1,
    "goggle_rental_price" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "club_settings_pkey" PRIMARY KEY ("setting_id")
);

INSERT INTO "club_settings" ("setting_id") VALUES (1);

INSERT INTO "finance_categories" ("key", "label", "type", "color")
VALUES ('goggle_rental', 'goggle rental', 'income', '#AB9726')
ON CONFLICT ("key") DO NOTHING;
