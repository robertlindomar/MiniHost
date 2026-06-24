export function isCoolifyResourceCreatedByMiniHost(rawData: unknown) {
  if (!rawData || typeof rawData !== "object") {
    return false;
  }

  const source = (rawData as { source?: string }).source;

  return source === "minihost-provision" || source === "minihost-publish";
}

export function mergeCoolifyResourceRawDataSource(rawData: unknown, source: "minihost-publish" | "minihost-provision") {
  const base = rawData && typeof rawData === "object" ? (rawData as Record<string, unknown>) : {};

  return {
    ...base,
    source
  };
}

export function resolveCreatedByMiniHost(
  link?: { createdByMiniHost?: boolean } | null,
  rawData?: unknown
) {
  if (link?.createdByMiniHost) {
    return true;
  }

  return isCoolifyResourceCreatedByMiniHost(rawData);
}

export type ResolvedCoolifyProject = {
  id: string;
  coolifyId: string;
  name: string;
  status: string;
  rawData: unknown;
  createdByMiniHost: boolean;
};

type CoolifyProjectLike = {
  id: string;
  coolifyId: string;
  name: string;
  status: string;
  rawData: unknown;
  source?: string | null;
  createdByMiniHost?: boolean;
};

export function resolveProjectCoolifyProjectFromLink(project: {
  coolifyLink?: {
    coolifyProject?: CoolifyProjectLike | null;
    source?: string | null;
    createdByMiniHost?: boolean;
  } | null;
}): ResolvedCoolifyProject | null {
  const coolifyProject = project.coolifyLink?.coolifyProject;

  if (!coolifyProject || coolifyProject.status === "REMOVED") {
    return null;
  }

  return {
    id: coolifyProject.id,
    coolifyId: coolifyProject.coolifyId,
    name: coolifyProject.name,
    status: coolifyProject.status,
    rawData: coolifyProject.rawData,
    createdByMiniHost: resolveCreatedByMiniHost(project.coolifyLink, coolifyProject.rawData)
  };
}

/** @deprecated Use resolveProjectCoolifyProjectFromLink. Kept for inconsistency detection fallback. */
export function resolveProjectCoolifyProjects(project: {
  coolifyLink?: { coolifyProject?: CoolifyProjectLike | null; source?: string | null; createdByMiniHost?: boolean } | null;
  applications: Array<{ coolifyProject?: CoolifyProjectLike | null }>;
}): ResolvedCoolifyProject[] {
  const primary = resolveProjectCoolifyProjectFromLink(project);

  if (primary) {
    return [primary];
  }

  const byId = new Map<string, ResolvedCoolifyProject>();

  for (const application of project.applications) {
    if (!application.coolifyProject || application.coolifyProject.status === "REMOVED") {
      continue;
    }

    byId.set(application.coolifyProject.id, {
      id: application.coolifyProject.id,
      coolifyId: application.coolifyProject.coolifyId,
      name: application.coolifyProject.name,
      status: application.coolifyProject.status,
      rawData: application.coolifyProject.rawData,
      createdByMiniHost: isCoolifyResourceCreatedByMiniHost(application.coolifyProject.rawData)
    });
  }

  return Array.from(byId.values());
}
