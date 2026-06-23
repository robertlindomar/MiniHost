import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { handleRouteError, ok } from "@/lib/server/http";
import { toDnsRecord, toDomain, toHistoryItem } from "@/lib/server/mappers";

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const [domains, records, history] = await Promise.all([
      prisma.domain.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.dnsRecord.findMany({
        where: { status: { not: "DELETED" } },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);

    return ok({
      domains: domains.map(toDomain),
      records: records.map(toDnsRecord),
      history: history.map(toHistoryItem)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
