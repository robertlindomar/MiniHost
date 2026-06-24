import type { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import {
  listCoolifyApplications,
  listCoolifyProjects,
  listCoolifyServers,
  type CoolifyRawResource
} from "@/lib/coolify";
import { prisma } from "@/lib/prisma";

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

export async function getCoolifyCachedResources() {
  const [servers, projects, applications] = await Promise.all([
    prisma.coolifyServer.findMany({ orderBy: [{ name: "asc" }, { createdAt: "desc" }] }),
    prisma.coolifyProject.findMany({ orderBy: [{ name: "asc" }, { createdAt: "desc" }] }),
    prisma.coolifyApplication.findMany({ orderBy: [{ name: "asc" }, { createdAt: "desc" }] })
  ]);

  return { servers, projects, applications };
}

export async function syncCoolifyResources() {
  const startedAt = new Date();
  const [servers, projects, applications] = await Promise.all([
    listCoolifyServers(),
    listCoolifyProjects(),
    listCoolifyApplications()
  ]);

  const serverWrites = servers.map((server) => {
    const coolifyId = resourceId(server, "server");
    const name = resourceName(server, coolifyId);

    return prisma.coolifyServer.upsert({
      where: { coolifyId },
      create: {
        coolifyId,
        name,
        description: readString(server, ["description"]),
        status: readString(server, ["status"]),
        ip: readString(server, ["ip", "ipAddress", "ip_address", "host", "address"]),
        rawData: toJsonValue(server),
        lastSyncedAt: startedAt
      },
      update: {
        name,
        description: readString(server, ["description"]),
        status: readString(server, ["status"]),
        ip: readString(server, ["ip", "ipAddress", "ip_address", "host", "address"]),
        rawData: toJsonValue(server),
        lastSyncedAt: startedAt
      }
    });
  });

  const projectWrites = projects.map((project) => {
    const coolifyId = resourceId(project, "project");
    const name = resourceName(project, coolifyId);

    return prisma.coolifyProject.upsert({
      where: { coolifyId },
      create: {
        coolifyId,
        name,
        description: readString(project, ["description"]),
        rawData: toJsonValue(project),
        lastSyncedAt: startedAt
      },
      update: {
        name,
        description: readString(project, ["description"]),
        rawData: toJsonValue(project),
        lastSyncedAt: startedAt
      }
    });
  });

  const applicationWrites = applications.map((application) => {
    const coolifyId = resourceId(application, "application");
    const name = resourceName(application, coolifyId);

    return prisma.coolifyApplication.upsert({
      where: { coolifyId },
      create: {
        coolifyId,
        name,
        fqdn: readStringList(application, ["fqdn", "fqdn_list", "domains"]),
        status: readString(application, ["status", "applicationStatus", "application_status"]),
        gitRepository: readString(application, [
          "gitRepository",
          "git_repository",
          "repository",
          "git_full_url",
          "gitFullUrl"
        ]),
        branch: readString(application, ["branch", "gitBranch", "git_branch"]),
        rawData: toJsonValue(application),
        lastSyncedAt: startedAt
      },
      update: {
        name,
        fqdn: readStringList(application, ["fqdn", "fqdn_list", "domains"]),
        status: readString(application, ["status", "applicationStatus", "application_status"]),
        gitRepository: readString(application, [
          "gitRepository",
          "git_repository",
          "repository",
          "git_full_url",
          "gitFullUrl"
        ]),
        branch: readString(application, ["branch", "gitBranch", "git_branch"]),
        rawData: toJsonValue(application),
        lastSyncedAt: startedAt
      }
    });
  });

  await Promise.all([...serverWrites, ...projectWrites, ...applicationWrites]);

  const cached = await getCoolifyCachedResources();

  return {
    syncedAt: startedAt,
    imported: {
      servers: servers.length,
      projects: projects.length,
      applications: applications.length
    },
    cached
  };
}
