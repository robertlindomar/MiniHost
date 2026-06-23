import { prisma } from "@/lib/prisma";
import { handleRouteError, ok } from "@/lib/server/http";
import { toHistoryItem } from "@/lib/server/mappers";

export async function GET() {
  try {
    const history = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return ok({ history: history.map(toHistoryItem) });
  } catch (error) {
    return handleRouteError(error);
  }
}
