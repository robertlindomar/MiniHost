import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

export async function seedInitialData(prisma: PrismaClient) {

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



  return domain;
}
