-- CreateEnum
CREATE TYPE "ProjectDatabaseStatus" AS ENUM ('PLANNED', 'CREATED_MANUALLY', 'ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "project_databases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "databaseName" TEXT NOT NULL,
    "databaseUser" TEXT NOT NULL,
    "databasePasswordEncrypted" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 5432,
    "status" "ProjectDatabaseStatus" NOT NULL DEFAULT 'PLANNED',
    "connectionUrlEncrypted" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "project_databases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_databases_projectId_idx" ON "project_databases"("projectId");

-- CreateIndex
CREATE INDEX "project_databases_status_idx" ON "project_databases"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_databases_host_databaseName_key" ON "project_databases"("host", "databaseName");

-- CreateIndex
CREATE UNIQUE INDEX "project_databases_host_databaseUser_key" ON "project_databases"("host", "databaseUser");

-- AddForeignKey
ALTER TABLE "project_databases" ADD CONSTRAINT "project_databases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
