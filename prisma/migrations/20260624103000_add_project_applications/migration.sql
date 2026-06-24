-- CreateEnum
CREATE TYPE "ProjectApplicationStatus" AS ENUM ('DRAFT', 'READY', 'LINKED', 'DEPLOYED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectApplicationType" AS ENUM ('FRONTEND', 'BACKEND', 'FULLSTACK', 'STATIC', 'DOCKERFILE', 'DOCKER_COMPOSE', 'OTHER');

-- CreateTable
CREATE TABLE "project_applications" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectDatabaseId" TEXT,
    "dnsRecordId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "ProjectApplicationType" NOT NULL DEFAULT 'FULLSTACK',
    "status" "ProjectApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "gitRepository" TEXT,
    "gitBranch" TEXT,
    "rootDirectory" TEXT,
    "buildCommand" TEXT,
    "startCommand" TEXT,
    "installCommand" TEXT,
    "outputDirectory" TEXT,
    "port" INTEGER,
    "domain" TEXT,
    "environmentVariablesEncrypted" TEXT,
    "coolifyServerId" TEXT,
    "coolifyProjectId" TEXT,
    "coolifyApplicationId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "project_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_applications_projectId_slug_key" ON "project_applications"("projectId", "slug");

-- CreateIndex
CREATE INDEX "project_applications_projectId_idx" ON "project_applications"("projectId");

-- CreateIndex
CREATE INDEX "project_applications_status_idx" ON "project_applications"("status");

-- CreateIndex
CREATE INDEX "project_applications_type_idx" ON "project_applications"("type");

-- CreateIndex
CREATE INDEX "project_applications_projectDatabaseId_idx" ON "project_applications"("projectDatabaseId");

-- CreateIndex
CREATE INDEX "project_applications_dnsRecordId_idx" ON "project_applications"("dnsRecordId");

-- CreateIndex
CREATE INDEX "project_applications_coolifyServerId_idx" ON "project_applications"("coolifyServerId");

-- CreateIndex
CREATE INDEX "project_applications_coolifyProjectId_idx" ON "project_applications"("coolifyProjectId");

-- CreateIndex
CREATE INDEX "project_applications_coolifyApplicationId_idx" ON "project_applications"("coolifyApplicationId");

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_projectDatabaseId_fkey" FOREIGN KEY ("projectDatabaseId") REFERENCES "project_databases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_dnsRecordId_fkey" FOREIGN KEY ("dnsRecordId") REFERENCES "dns_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_coolifyServerId_fkey" FOREIGN KEY ("coolifyServerId") REFERENCES "coolify_servers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_coolifyProjectId_fkey" FOREIGN KEY ("coolifyProjectId") REFERENCES "coolify_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_applications" ADD CONSTRAINT "project_applications_coolifyApplicationId_fkey" FOREIGN KEY ("coolifyApplicationId") REFERENCES "coolify_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
