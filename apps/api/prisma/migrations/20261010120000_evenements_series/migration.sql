-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'HIDDEN');

-- AlterEnum
ALTER TYPE "AdminActionKind" ADD VALUE 'EVENT_HIDE';

-- DropIndex
DROP INDEX "Event_seriesId_idx";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "occurrenceDate" DATE,
ADD COLUMN     "overridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "EventStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "eventId" TEXT;

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "createdById" TEXT,
    "rrule" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "untilDate" DATE,
    "startMinute" INTEGER NOT NULL,
    "durationMinutes" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'PUBLISHED',
    "materializedUntil" DATE NOT NULL,
    "type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER,
    "priceCents" INTEGER,
    "minAge" INTEGER,
    "registrationMode" "RegistrationMode" NOT NULL DEFAULT 'IN_APP',
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventSeriesGames" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventSeriesGames_AB_pkey" PRIMARY KEY ("A","B")
);

-- Données : un événement annulé garde ce statut
UPDATE "Event" SET "status" = 'CANCELLED' WHERE "cancelledAt" IS NOT NULL;
ALTER TABLE "Event" DROP COLUMN "cancelledAt";

-- Données : les séries créées au back-office (une occurrence par semaine) deviennent des EventSeries
-- terminées à leur dernière date ; chaque occurrence garde sa date locale prévue.
UPDATE "Event" SET "occurrenceDate" = ("startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::date
WHERE "seriesId" IS NOT NULL;

INSERT INTO "EventSeries" ("id", "venueId", "rrule", "startDate", "untilDate", "startMinute",
  "durationMinutes", "status", "materializedUntil", "type", "title", "description", "capacity",
  "priceCents", "minAge", "registrationMode", "externalUrl", "updatedAt")
SELECT DISTINCT ON (e."seriesId") e."seriesId", e."venueId",
  'FREQ=WEEKLY;INTERVAL=1;BYDAY=' || (ARRAY['MO','TU','WE','TH','FR','SA','SU'])[EXTRACT(ISODOW FROM e."occurrenceDate")::int],
  e."occurrenceDate", last."date",
  EXTRACT(HOUR FROM e."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::int * 60
    + EXTRACT(MINUTE FROM e."startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Paris')::int,
  CASE WHEN e."endsAt" IS NULL THEN NULL ELSE (EXTRACT(EPOCH FROM e."endsAt" - e."startsAt") / 60)::int END,
  'PUBLISHED', last."date" + 1, e."type", e."title", e."description", e."capacity",
  e."priceCents", e."minAge", e."registrationMode", e."externalUrl", CURRENT_TIMESTAMP
FROM "Event" e
JOIN (SELECT "seriesId", MAX("occurrenceDate") AS "date" FROM "Event" GROUP BY "seriesId") last
  ON last."seriesId" = e."seriesId"
WHERE e."seriesId" IS NOT NULL
ORDER BY e."seriesId", e."startsAt";

INSERT INTO "_EventSeriesGames" ("A", "B")
SELECT DISTINCT e."seriesId", g."B" FROM "Event" e JOIN "_EventGames" g ON g."A" = e."id"
WHERE e."seriesId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "EventSeries_venueId_idx" ON "EventSeries"("venueId");

-- CreateIndex
CREATE INDEX "EventSeries_status_materializedUntil_idx" ON "EventSeries"("status", "materializedUntil");

-- CreateIndex
CREATE INDEX "_EventSeriesGames_B_index" ON "_EventSeriesGames"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Event_seriesId_occurrenceDate_key" ON "Event"("seriesId", "occurrenceDate");

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventSeriesGames" ADD CONSTRAINT "_EventSeriesGames_A_fkey" FOREIGN KEY ("A") REFERENCES "EventSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventSeriesGames" ADD CONSTRAINT "_EventSeriesGames_B_fkey" FOREIGN KEY ("B") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

