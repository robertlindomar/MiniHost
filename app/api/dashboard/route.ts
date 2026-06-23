import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { handleRouteError, ok } from "@/lib/server/http";
import { toDnsRecord, toDomain, toHistoryItem, toProject, toProjectDatabase } from "@/lib/server/mappers";

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const [domains, records, projects, databases, history] = await Promise.all([
      prisma.domain.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.dnsRecord.findMany({
        where: { status: { not: "DELETED" } },
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      }),
      prisma.project.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              records: {
                where: { status: { not: "DELETED" } }
              },
              databases: {
                where: { status: { not: "ARCHIVED" } }
              }
            }
          }
        }
      }),
      prisma.projectDatabase.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);

    return ok({
      domains: domains.map(toDomain),
      records: records.map(toDnsRecord),
      projects: projects.map(toProject),
      databases: databases.map(toProjectDatabase),
      history: history.map(toHistoryItem)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
