-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('VALID', 'DISPUTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "AdminActionKind" ADD VALUE 'VISIT_DECIDE';

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "pricePerVisitCents" INTEGER;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "disputeReason" TEXT,
ADD COLUMN     "disputedAt" TIMESTAMP(3),
ADD COLUMN     "priceCents" INTEGER,
ADD COLUMN     "status" "VisitStatus" NOT NULL DEFAULT 'VALID';

