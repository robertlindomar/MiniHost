-- AlterEnum
ALTER TYPE "ProjectDatabaseStatus" ADD VALUE IF NOT EXISTS 'DESTROYED';
ALTER TYPE "ProjectDatabaseStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_DESTROYED';

-- AlterTable
ALTER TABLE "project_databases" ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "disabledBy" TEXT,
ADD COLUMN "destroyedAt" TIMESTAMP(3),
ADD COLUMN "destroyedBy" TEXT,
ADD COLUMN "lastDestructionError" TEXT;
