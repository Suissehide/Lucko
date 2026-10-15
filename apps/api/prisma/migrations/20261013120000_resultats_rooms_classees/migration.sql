-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISPUTED', 'RESOLVED', 'VOID');

-- AlterEnum
ALTER TYPE "AdminActionKind" ADD VALUE 'RESULT_DECIDE';
ALTER TYPE "AdminActionKind" ADD VALUE 'RESULT_VOID';

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "placements" JSONB NOT NULL,
    "score" TEXT,
    "status" "ResultStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultConfirmation" (
    "resultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "placements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultConfirmation_pkey" PRIMARY KEY ("resultId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchResult_roomId_key" ON "MatchResult"("roomId");

-- CreateIndex
CREATE INDEX "MatchResult_status_idx" ON "MatchResult"("status");

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultConfirmation" ADD CONSTRAINT "ResultConfirmation_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "MatchResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultConfirmation" ADD CONSTRAINT "ResultConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

