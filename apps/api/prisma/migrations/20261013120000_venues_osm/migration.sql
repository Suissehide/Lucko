-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "osmId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Venue_osmId_key" ON "Venue"("osmId");
