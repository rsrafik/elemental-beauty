-- A draft lab can be saved before it has a date; publishing still needs one.
ALTER TABLE "labs" ALTER COLUMN "date" DROP NOT NULL;
