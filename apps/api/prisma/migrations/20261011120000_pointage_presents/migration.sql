-- CreateEnum
CREATE TYPE "PresenceSource" AS ENUM ('HOST', 'VENUE');

-- AlterTable
ALTER TABLE "RoomParticipant" ADD COLUMN     "presenceMarkedById" TEXT,
ADD COLUMN     "presenceSource" "PresenceSource",
ADD COLUMN     "present" BOOLEAN;

