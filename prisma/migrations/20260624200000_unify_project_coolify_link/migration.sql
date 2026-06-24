-- DropForeignKey
ALTER TABLE "project_coolify_links" DROP CONSTRAINT IF EXISTS "project_coolify_links_coolifyApplicationCacheId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "project_coolify_links_coolifyApplicationCacheId_idx";

-- AlterTable
ALTER TABLE "project_coolify_links" DROP COLUMN IF EXISTS "coolifyApplicationCacheId",
ADD COLUMN     "source" TEXT,
ADD COLUMN     "createdByMiniHost" BOOLEAN NOT NULL DEFAULT false;
