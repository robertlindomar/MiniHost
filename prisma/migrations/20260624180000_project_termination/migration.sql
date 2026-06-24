-- AlterEnum
ALTER TYPE "ProjectStatus" ADD VALUE 'TERMINATING';
ALTER TYPE "ProjectStatus" ADD VALUE 'TERMINATED';
ALTER TYPE "ProjectStatus" ADD VALUE 'TERMINATED_WITH_ERRORS';

-- AlterEnum
ALTER TYPE "ProjectApplicationStatus" ADD VALUE 'REMOVED_REMOTE';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "terminatedAt" TIMESTAMP(3),
ADD COLUMN     "terminatedBy" TEXT,
ADD COLUMN     "terminationStatus" TEXT,
ADD COLUMN     "lastTerminationError" TEXT,
ADD COLUMN     "terminationPending" JSONB;

-- AlterTable
ALTER TABLE "project_applications" ADD COLUMN     "destroyedAt" TIMESTAMP(3),
ADD COLUMN     "destroyedBy" TEXT,
ADD COLUMN     "destroyStatus" TEXT,
ADD COLUMN     "lastDestroyError" TEXT;
