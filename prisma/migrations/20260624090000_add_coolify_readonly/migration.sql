-- CreateEnum
CREATE TYPE "CoolifyCredentialStatus" AS ENUM ('ACTIVE', 'INVALID', 'DISABLED');

-- CreateTable
CREATE TABLE "coolify_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "baseUrl" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "status" "CoolifyCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coolify_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coolify_servers" (
    "id" TEXT NOT NULL,
    "coolifyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT,
    "ip" TEXT,
    "rawData" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coolify_servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coolify_projects" (
    "id" TEXT NOT NULL,
    "coolifyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rawData" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coolify_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coolify_applications" (
    "id" TEXT NOT NULL,
    "coolifyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fqdn" TEXT,
    "status" TEXT,
    "gitRepository" TEXT,
    "branch" TEXT,
    "rawData" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coolify_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_coolify_links" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "coolifyProjectCacheId" TEXT,
    "coolifyApplicationCacheId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_coolify_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coolify_credentials_name_key" ON "coolify_credentials"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coolify_servers_coolifyId_key" ON "coolify_servers"("coolifyId");

-- CreateIndex
CREATE INDEX "coolify_servers_name_idx" ON "coolify_servers"("name");

-- CreateIndex
CREATE INDEX "coolify_servers_status_idx" ON "coolify_servers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "coolify_projects_coolifyId_key" ON "coolify_projects"("coolifyId");

-- CreateIndex
CREATE INDEX "coolify_projects_name_idx" ON "coolify_projects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "coolify_applications_coolifyId_key" ON "coolify_applications"("coolifyId");

-- CreateIndex
CREATE INDEX "coolify_applications_name_idx" ON "coolify_applications"("name");

-- CreateIndex
CREATE INDEX "coolify_applications_status_idx" ON "coolify_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_coolify_links_projectId_key" ON "project_coolify_links"("projectId");

-- CreateIndex
CREATE INDEX "project_coolify_links_coolifyProjectCacheId_idx" ON "project_coolify_links"("coolifyProjectCacheId");

-- CreateIndex
CREATE INDEX "project_coolify_links_coolifyApplicationCacheId_idx" ON "project_coolify_links"("coolifyApplicationCacheId");

-- AddForeignKey
ALTER TABLE "project_coolify_links" ADD CONSTRAINT "project_coolify_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_coolify_links" ADD CONSTRAINT "project_coolify_links_coolifyProjectCacheId_fkey" FOREIGN KEY ("coolifyProjectCacheId") REFERENCES "coolify_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_coolify_links" ADD CONSTRAINT "project_coolify_links_coolifyApplicationCacheId_fkey" FOREIGN KEY ("coolifyApplicationCacheId") REFERENCES "coolify_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
