import { PrismaClient } from "@prisma/client";
import { seedInitialData } from "./seed-data";

const prisma = new PrismaClient();

async function main() {
  await seedInitialData(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
