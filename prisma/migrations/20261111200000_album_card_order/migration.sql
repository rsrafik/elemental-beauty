-- The album's cards are put in order by dragging them on /landing-editor,
-- rather than sorted by date. The cards already there keep the order they
-- had: newest date first.
ALTER TABLE "album_cards" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

UPDATE "album_cards" SET "position" = ordered.at
FROM (
    SELECT "card_id", row_number() OVER (ORDER BY "date" DESC NULLS LAST, "card_id" DESC) - 1 AS at
    FROM "album_cards"
) AS ordered
WHERE "album_cards"."card_id" = ordered."card_id";
