-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "qrNonce" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Visit_qrNonce_key" ON "Visit"("qrNonce");
