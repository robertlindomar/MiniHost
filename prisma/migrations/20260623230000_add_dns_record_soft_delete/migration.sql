-- AlterTable
ALTER TABLE "dns_records" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT,
ADD COLUMN "deletionReason" TEXT;

-- CreateIndex
CREATE INDEX "dns_records_status_idx" ON "dns_records"("status");
