-- AlterTable
ALTER TABLE "dns_records" ADD COLUMN "cloudflareRecordId" TEXT;
ALTER TABLE "dns_records" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "dns_records" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "dns_records_cloudflareRecordId_key" ON "dns_records"("cloudflareRecordId");

-- CreateIndex
CREATE INDEX "dns_records_source_idx" ON "dns_records"("source");
