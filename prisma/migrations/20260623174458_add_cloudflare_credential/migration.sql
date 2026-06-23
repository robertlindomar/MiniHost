-- CreateEnum
CREATE TYPE "CloudflareCredentialStatus" AS ENUM ('ACTIVE', 'INVALID', 'DISABLED');

-- CreateTable
CREATE TABLE "cloudflare_credentials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'default',
    "tokenEncrypted" TEXT NOT NULL,
    "status" "CloudflareCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloudflare_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cloudflare_credentials_name_key" ON "cloudflare_credentials"("name");
