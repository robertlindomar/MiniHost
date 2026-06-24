-- AlterEnum
ALTER TYPE "ProjectApplicationStatus" ADD VALUE 'ENVS_APPLIED';
ALTER TYPE "ProjectApplicationStatus" ADD VALUE 'DEPLOYING';

-- AlterTable
ALTER TABLE "project_applications" ADD COLUMN "envsAppliedAt" TIMESTAMP(3),
ADD COLUMN "lastEnvsApplyStatus" TEXT,
ADD COLUMN "lastEnvsApplyMessage" TEXT,
ADD COLUMN "lastDeployStartedAt" TIMESTAMP(3),
ADD COLUMN "lastDeployStatus" TEXT,
ADD COLUMN "lastDeployMessage" TEXT,
ADD COLUMN "lastCoolifySyncAt" TIMESTAMP(3);
