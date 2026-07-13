-- CreateEnum
CREATE TYPE "event_type" AS ENUM ('official', 'social');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "type" "event_type" NOT NULL DEFAULT 'social';
