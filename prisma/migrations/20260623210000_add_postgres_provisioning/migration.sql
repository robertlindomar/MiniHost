-- AlterEnum
ALTER TYPE "ProjectDatabaseStatus" ADD VALUE IF NOT EXISTS 'PROVISIONING';
ALTER TYPE "ProjectDatabaseStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- AlterTable
ALTER TABLE "project_databases" ADD COLUMN "provisionedAt" TIMESTAMP(3),
ADD COLUMN "provisionedBy" TEXT,
ADD COLUMN "lastProvisionError" TEXT;

-- CreateEnum
CREATE TYPE "PostgresAdminCredentialStatus" AS ENUM ('ACTIVE', 'INVALID', 'DISABLED');

-- CreateTable
CREATE TABLE "postgres_admin_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 5432,
    "maintenanceDatabase" TEXT NOT NULL DEFAULT 'postgres',
    "username" TEXT NOT NULL,
    "passwordEncrypted" TEXT NOT NULL,
    "sslEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "PostgresAdminCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postgres_admin_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "postgres_admin_credentials_name_key" ON "postgres_admin_credentials"("name");
