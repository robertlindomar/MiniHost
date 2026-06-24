import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { handleRouteError, ok } from "@/lib/server/http";
import { toDnsRecord, toDomain, toHistoryItem, toProject, toProjectDatabase } from "@/lib/server/mappers";

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const [
      domains,
      records,
      projects,
      databases,
      history,
      activeCoolifyResourcesCount,
      missingCoolifyResourcesCount,
      removedCoolifyResourcesCount,
      brokenCoolifyProjectLinksCount,
      plannedApplicationsCount,
      readyApplicationsCount,
      linkedApplicationsCount,
      applicationsWithoutDomainCount
    ] = await Promise.all([
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
      prisma.auditLog.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 }),
      Promise.all([
        prisma.coolifyServer.count({ where: { status: "ACTIVE" } }),
        prisma.coolifyProject.count({ where: { status: "ACTIVE" } }),
        prisma.coolifyApplication.count({ where: { status: "ACTIVE" } })
      ]).then((counts) => counts.reduce((total, count) => total + count, 0)),
      Promise.all([
        prisma.coolifyServer.count({ where: { status: "MISSING" } }),
        prisma.coolifyProject.count({ where: { status: "MISSING" } }),
        prisma.coolifyApplication.count({ where: { status: "MISSING" } })
      ]).then((counts) => counts.reduce((total, count) => total + count, 0)),
      Promise.all([
        prisma.coolifyServer.count({ where: { status: "REMOVED" } }),
        prisma.coolifyProject.count({ where: { status: "REMOVED" } }),
        prisma.coolifyApplication.count({ where: { status: "REMOVED" } })
      ]).then((counts) => counts.reduce((total, count) => total + count, 0)),
      prisma.project.count({
        where: {
          status: { not: "ARCHIVED" },
          coolifyLink: {
            is: {
              OR: [
                {
                  coolifyProject: {
                    is: {
                      status: { in: ["MISSING", "REMOVED"] }
                    }
                  }
                },
                {
                  coolifyApplication: {
                    is: {
                      status: { in: ["MISSING", "REMOVED"] }
                    }
                  }
                }
              ]
            }
          }
        }
      }),
      prisma.projectApplication.count({
        where: { status: { not: "ARCHIVED" } }
      }),
      prisma.projectApplication.count({
        where: { status: "READY" }
      }),
      prisma.projectApplication.count({
        where: {
          status: { not: "ARCHIVED" },
          coolifyApplicationId: { not: null }
        }
      }),
      prisma.projectApplication.count({
        where: {
          status: { not: "ARCHIVED" },
          OR: [{ domain: null }, { domain: "" }]
        }
      })
    ]);

    return ok({
      domains: domains.map(toDomain),
      records: records.map(toDnsRecord),
      projects: projects.map(toProject),
      databases: databases.map(toProjectDatabase),
      history: history.map(toHistoryItem),
      coolifySummary: {
        activeResources: activeCoolifyResourcesCount,
        missingResources: missingCoolifyResourcesCount,
        removedResources: removedCoolifyResourcesCount,
        brokenProjectLinks: brokenCoolifyProjectLinksCount
      },
      applicationSummary: {
        planned: plannedApplicationsCount,
        ready: readyApplicationsCount,
        linkedToCoolify: linkedApplicationsCount,
        withoutDomain: applicationsWithoutDomainCount
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
