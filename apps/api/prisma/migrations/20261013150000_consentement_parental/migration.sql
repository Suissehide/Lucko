-- CreateEnum
CREATE TYPE "ParentalConsentStatus" AS ENUM ('PENDING', 'GRANTED');

-- CreateTable
CREATE TABLE "ParentalConsent" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "status" "ParentalConsentStatus" NOT NULL DEFAULT 'PENDING',
    "parentId" TEXT,
    "grantedAt" TIMESTAMP(3),
    "policyVersion" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "sameDeviceSuspected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentalConsent_childId_idx" ON "ParentalConsent"("childId");

-- AddForeignKey
ALTER TABLE "ParentalConsent" ADD CONSTRAINT "ParentalConsent_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentalConsent" ADD CONSTRAINT "ParentalConsent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

