-- Coolify cache reconciliation fields.
-- Existing rows are preserved and treated as ACTIVE until the next sync proves otherwise.

ALTER TABLE "coolify_servers"
  ADD COLUMN "remoteStatus" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "missingSince" TIMESTAMP(3),
  ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "coolify_servers"
SET "remoteStatus" = "status",
    "status" = 'ACTIVE',
    "isActive" = true,
    "lastSeenAt" = COALESCE("lastSyncedAt", "updatedAt");

ALTER TABLE "coolify_servers"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "status" SET NOT NULL;

ALTER TABLE "coolify_projects"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "remoteStatus" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "missingSince" TIMESTAMP(3),
  ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "coolify_projects"
SET "isActive" = true,
    "lastSeenAt" = COALESCE("lastSyncedAt", "updatedAt");

CREATE INDEX "coolify_projects_status_idx" ON "coolify_projects"("status");

ALTER TABLE "coolify_applications"
  ADD COLUMN "remoteStatus" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "missingSince" TIMESTAMP(3),
  ADD COLUMN "removedAt" TIMESTAMP(3);

UPDATE "coolify_applications"
SET "remoteStatus" = "status",
    "status" = 'ACTIVE',
    "isActive" = true,
    "lastSeenAt" = COALESCE("lastSyncedAt", "updatedAt");

ALTER TABLE "coolify_applications"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
  ALTER COLUMN "status" SET NOT NULL;
