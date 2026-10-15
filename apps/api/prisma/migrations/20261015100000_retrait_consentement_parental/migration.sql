-- AlterEnum
ALTER TYPE "ParentalConsentStatus" ADD VALUE 'WITHDRAWN';

-- AlterTable
ALTER TABLE "ParentalConsent" ADD COLUMN     "withdrawnAt" TIMESTAMP(3);

