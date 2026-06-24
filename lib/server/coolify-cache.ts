import type { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import {
  listCoolifyApplications,
  listCoolifyProjects,
  listCoolifyServers,
  type CoolifyRawResource
} from "@/lib/coolify";
import { prisma } from "@/lib/prisma";

type CoolifyKind = "servers" | "projects" | "applications";
type ReconciliationSummary = {
  active: number;
  missing: number;
  removed: number;
};

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readString(resource: CoolifyRawResource, keys: string[]) {
  for (const key of keys) {
    const value = resource[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function readStringList(resource: CoolifyRawResource, keys: string[]) {
  for (const key of keys) {
    const value = resource[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const strings = value.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim())
      );

      if (strings.length > 0) {
        return strings.join(", ");
      }
    }
  }

  return null;
}

function resourceId(resource: CoolifyRawResource, kind: "server" | "project" | "application") {
  const directId = readString(resource, ["uuid", "id", "coolifyId", "coolify_id"]);

  if (directId) {
    return directId;
  }

  const name = readString(resource, ["name", "fqdn"])?.toLowerCase();

  if (name) {
    return `${kind}:${name}`;
  }

  const fingerprint = createHash("sha1").update(JSON.stringify(resource)).digest("hex").slice(0, 12);
  return `${kind}:${fingerprint}`;
}

function resourceName(resource: CoolifyRawResource, fallback: string) {
  return readString(resource, ["name", "title", "fqdn", "uuid", "id"]) ?? fallback;
}

export async function getCoolifyCachedResources(options: { includeRemoved?: boolean } = {}) {
  const where = options.includeRemoved ? undefined : { status: { not: "REMOVED" } };
  const [servers, projects, applications] = await Promise.all([
    prisma.coolifyServer.findMany({ where, orderBy: [{ name: "asc" }, { createdAt: "desc" }] }),
    prisma.coolifyProject.findMany({ where, orderBy: [{ name: "asc" }, { createdAt: "desc" }] }),
    prisma.coolifyApplication.findMany({ where, orderBy: [{ name: "asc" }, { createdAt: "desc" }] })
  ]);

  return { servers, projects, applications };
}

async function reconcileServers(resources: CoolifyRawResource[], syncedAt: Date) {
  const seenIds = new Set<string>();

  for (const server of resources) {
    const coolifyId = resourceId(server, "server");
    const name = resourceName(server, coolifyId);
    seenIds.add(coolifyId);

    await prisma.coolifyServer.upsert({
      where: { coolifyId },
      create: {
        coolifyId,
        name,
        description: readString(server, ["description"]),
        status: "ACTIVE",
        remoteStatus: readString(server, ["status"]),
        ip: readString(server, ["ip", "ipAddress", "ip_address", "host", "address"]),
        isActive: true,
        lastSeenAt: syncedAt,
        missingSince: null,
        removedAt: null,
        rawData: toJsonValue(server),
        lastSyncedAt: syncedAt
      },
      update: {
        name,
        description: readString(server, ["description"]),
        status: "ACTIVE",
        remoteStatus: readString(server, ["status"]),
        ip: readString(server, ["ip", "ipAddress", "ip_address", "host", "address"]),
        isActive: true,
        lastSeenAt: syncedAt,
        missingSince: null,
        removedAt: null,
        rawData: toJsonValue(server),
        lastSyncedAt: syncedAt
      }
    });
  }

  const candidates = await prisma.coolifyServer.findMany({
    where: seenIds.size > 0 ? { coolifyId: { notIn: Array.from(seenIds) } } : undefined
  });

  let missing = 0;
  let removed = 0;

  for (const candidate of candidates) {
    if (candidate.status === "ACTIVE") {
      await prisma.coolifyServer.update({
        where: { id: candidate.id },
        data: {
          status: "MISSING",
          isActive: false,
          missingSince: candidate.missingSince ?? syncedAt,
          lastSyncedAt: syncedAt
        }
      });
      missing += 1;
    } else if (candidate.status === "MISSING") {
      await prisma.coolifyServer.update({
        where: { id: candidate.id },
        data: {
          status: "REMOVED",
          isActive: false,
          removedAt: candidate.removedAt ?? syncedAt,
          lastSyncedAt: syncedAt
        }
      });
      removed += 1;
    }
  }

  return { active: resources.length, missing, removed };
}

async function reconcileProjects(resources: CoolifyRawResource[], syncedAt: Date) {
  const seenIds = new Set<string>();

  for (const project of resources) {
    const coolifyId = resourceId(project, "project");
    const name = resourceName(project, coolifyId);
    seenIds.add(coolifyId);

    await prisma.coolifyProject.upsert({
      where: { coolifyId },
      create: {
        coolifyId,
        name,
        description: readString(project, ["description"]),
        status: "ACTIVE",
        remoteStatus: readString(project, ["status"]),
        isActive: true,
        lastSeenAt: syncedAt,
        missingSince: null,
        removedAt: null,
        rawData: toJsonValue(project),
        lastSyncedAt: syncedAt
      },
      update: {
        name,
        description: readString(project, ["description"]),
        status: "ACTIVE",
        remoteStatus: readString(project, ["status"]),
        isActive: true,
        lastSeenAt: syncedAt,
        missingSince: null,
        removedAt: null,
        rawData: toJsonValue(project),
        lastSyncedAt: syncedAt
      }
    });
  }

  const candidates = await prisma.coolifyProject.findMany({
    where: seenIds.size > 0 ? { coolifyId: { notIn: Array.from(seenIds) } } : undefined
  });

  let missing = 0;
  let removed = 0;

  for (const candidate of candidates) {
    if (candidate.status === "ACTIVE") {
      await prisma.coolifyProject.update({
        where: { id: candidate.id },
        data: {
          status: "MISSING",
          isActive: false,
          missingSince: candidate.missingSince ?? syncedAt,
          lastSyncedAt: syncedAt
        }
      });
      missing += 1;
    } else if (candidate.status === "MISSING") {
      await prisma.coolifyProject.update({
        where: { id: candidate.id },
        data: {
          status: "REMOVED",
          isActive: false,
          removedAt: candidate.removedAt ?? syncedAt,
          lastSyncedAt: syncedAt
        }
      });
      removed += 1;
    }
  }

  return { active: resources.length, missing, removed };
}

async function reconcileApplications(resources: CoolifyRawResource[], syncedAt: Date) {
  const seenIds = new Set<string>();

  for (const application of resources) {
    const coolifyId = resourceId(application, "application");
    const name = resourceName(application, coolifyId);
    seenIds.add(coolifyId);

    await prisma.coolifyApplication.upsert({
      where: { coolifyId },
      create: {
        coolifyId,
        name,
        fqdn: readStringList(application, ["fqdn", "fqdn_list", "domains"]),
        status: "ACTIVE",
        remoteStatus: readString(application, ["status", "applicationStatus", "application_status"]),
        gitRepository: readString(application, [
          "gitRepository",
          "git_repository",
          "repository",
          "git_full_url",
          "gitFullUrl"
        ]),
        branch: readString(application, ["branch", "gitBranch", "git_branch"]),
        isActive: true,
        lastSeenAt: syncedAt,
        missingSince: null,
        removedAt: null,
        rawData: toJsonValue(application),
        lastSyncedAt: syncedAt
      },
      update: {
        name,
        fqdn: readStringList(application, ["fqdn", "fqdn_list", "domains"]),
        status: "ACTIVE",
        remoteStatus: readString(application, ["status", "applicationStatus", "application_status"]),
        gitRepository: readString(application, [
          "gitRepository",
          "git_repository",
          "repository",
          "git_full_url",
          "gitFullUrl"
        ]),
        branch: readString(application, ["branch", "gitBranch", "git_branch"]),
        isActive: true,
        lastSeenAt: syncedAt,
        missingSince: null,
        removedAt: null,
        rawData: toJsonValue(application),
        lastSyncedAt: syncedAt
      }
    });
  }

  const candidates = await prisma.coolifyApplication.findMany({
    where: seenIds.size > 0 ? { coolifyId: { notIn: Array.from(seenIds) } } : undefined
  });

  let missing = 0;
  let removed = 0;

  for (const candidate of candidates) {
    if (candidate.status === "ACTIVE") {
      await prisma.coolifyApplication.update({
        where: { id: candidate.id },
        data: {
          status: "MISSING",
          isActive: false,
          missingSince: candidate.missingSince ?? syncedAt,
          lastSyncedAt: syncedAt
        }
      });
      missing += 1;
    } else if (candidate.status === "MISSING") {
      await prisma.coolifyApplication.update({
        where: { id: candidate.id },
        data: {
          status: "REMOVED",
          isActive: false,
          removedAt: candidate.removedAt ?? syncedAt,
          lastSyncedAt: syncedAt
        }
      });
      removed += 1;
    }
  }

  return { active: resources.length, missing, removed };
}

export async function syncCoolifyResources() {
  const startedAt = new Date();
  const [servers, projects, applications] = await Promise.all([
    listCoolifyServers(),
    listCoolifyProjects(),
    listCoolifyApplications()
  ]);

  const [serverSummary, projectSummary, applicationSummary] = await Promise.all([
    reconcileServers(servers, startedAt),
    reconcileProjects(projects, startedAt),
    reconcileApplications(applications, startedAt)
  ]);

  const cached = await getCoolifyCachedResources({ includeRemoved: true });

  return {
    syncedAt: startedAt,
    imported: {
      servers: servers.length,
      projects: projects.length,
      applications: applications.length
    },
    reconciliation: {
      servers: serverSummary,
      projects: projectSummary,
      applications: applicationSummary
    } satisfies Record<CoolifyKind, ReconciliationSummary>,
    cached
  };
}
