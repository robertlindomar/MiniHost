-- AlterTable
ALTER TABLE "project_applications" ADD COLUMN "provisionedAt" TIMESTAMP(3),
ADD COLUMN "provisionedBy" TEXT,
ADD COLUMN "lastProvisionStatus" TEXT,
ADD COLUMN "lastProvisionMessage" TEXT;
