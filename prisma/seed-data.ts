import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function seedInitialData(prisma: PrismaClient) {
  const defaultAdminPasswordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@minihost.local" },
    update: {
      name: "Administrador MiniHost",
      passwordHash: defaultAdminPasswordHash,
      role: "ADMIN"
    },
    create: {
      name: "Administrador MiniHost",
      email: "admin@minihost.local",
      passwordHash: defaultAdminPasswordHash,
      role: "ADMIN"
    }
  });

  const personalAdminPasswordHash = await bcrypt.hash("123456", 12);
  await prisma.user.upsert({
    where: { email: "robertlindomar18@gmail.com" },
    update: {
      name: "Robert Lindomar",
      role: "ADMIN"
    },
    create: {
      name: "Robert Lindomar",
      email: "robertlindomar18@gmail.com",
      passwordHash: personalAdminPasswordHash,
      role: "ADMIN"
    }
  });

  const domain = await prisma.domain.upsert({
    where: { name: "robertlindomar.dev" },
    update: {
      provider: "Cloudflare",
      zoneId: "fake-zone-robertlindomar",
      status: "active"
    },
    create: {
      name: "robertlindomar.dev",
      provider: "Cloudflare",
      zoneId: "fake-zone-robertlindomar",
      status: "active"
    }
  });

  const records = [
    {
      type: "A",
      name: "@",
      content: "147.15.126.225",
      ttl: null,
      proxied: true,
      status: "active",
      comment: "Entrada principal da VPS",
      priority: null
    },
    {
      type: "A",
      name: "painel",
      content: "147.15.126.225",
      ttl: null,
      proxied: true,
      status: "active",
      comment: "Painel administrativo",
      priority: null
    },
    {
      type: "CNAME",
      name: "www",
      content: "robertlindomar.dev",
      ttl: null,
      proxied: true,
      status: "active",
      comment: null,
      priority: null
    },
    {
      type: "TXT",
      name: "_verify",
      content: "minihost-verification=fake-token",
      ttl: 3600,
      proxied: false,
      status: "active",
      comment: "Verificação simulada",
      priority: null
    }
  ];

  for (const record of records) {
    const existing = await prisma.dnsRecord.findFirst({
      where: {
        domainId: domain.id,
        type: record.type,
        name: record.name
      }
    });

    if (existing) {
      await prisma.dnsRecord.update({
        where: { id: existing.id },
        data: record
      });
    } else {
      await prisma.dnsRecord.create({
        data: {
          ...record,
          domainId: domain.id
        }
      });
    }
  }

  await prisma.appSetting.createMany({
    data: [
      { key: "cloudflareApiToken", value: "" },
      { key: "defaultZoneId", value: "fake-zone-robertlindomar" },
      { key: "defaultDomain", value: "robertlindomar.dev" },
      { key: "defaultVpsIp", value: "147.15.126.225" },
      { key: "defaultProxyEnabled", value: "true" }
    ],
    skipDuplicates: true
  });

  await prisma.auditLog.create({
    data: {
      action: "Seed executado",
      entityType: "settings",
      userId: admin.id,
      entityName: "Dados iniciais",
      description: "Dados iniciais e admin da Etapa 3 criados ou atualizados no PostgreSQL.",
      newData: {
        admin: admin.email,
        domain: domain.name,
        records: records.map((record) => `${record.type} ${record.name}`)
      }
    }
  });

  return domain;
}
