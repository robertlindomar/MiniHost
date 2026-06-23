import type { PrismaClient } from "@prisma/client";

export async function seedInitialData(prisma: PrismaClient) {
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
      content: "72.60.250.39",
      ttl: null,
      proxied: true,
      status: "active",
      comment: "Entrada principal da VPS",
      priority: null
    },
    {
      type: "A",
      name: "painel",
      content: "72.60.250.39",
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
      { key: "defaultVpsIp", value: "72.60.250.39" },
      { key: "defaultProxyEnabled", value: "true" }
    ],
    skipDuplicates: true
  });

  await prisma.auditLog.create({
    data: {
      action: "Seed executado",
      entityType: "settings",
      entityName: "Dados iniciais",
      description: "Dados iniciais da Etapa 2 criados ou atualizados no PostgreSQL.",
      newData: {
        domain: domain.name,
        records: records.map((record) => `${record.type} ${record.name}`)
      }
    }
  });

  return domain;
}
