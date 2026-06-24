export function isCoolifyResourceCreatedByMiniHost(rawData: unknown) {
  if (!rawData || typeof rawData !== "object") {
    return false;
  }

  const source = (rawData as { source?: string }).source;

  return source === "minihost-provision" || source === "minihost-publish";
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
};

export function resolveProjectCoolifyProjects(project: {
  coolifyLink?: { coolifyProject?: CoolifyProjectLike | null } | null;
  applications: Array<{ coolifyProject?: CoolifyProjectLike | null }>;
}): ResolvedCoolifyProject[] {
  const byId = new Map<string, ResolvedCoolifyProject>();

  const addProject = (coolifyProject?: CoolifyProjectLike | null) => {
    if (!coolifyProject || coolifyProject.status === "REMOVED") {
      return;
    }

    byId.set(coolifyProject.id, {
      id: coolifyProject.id,
      coolifyId: coolifyProject.coolifyId,
      name: coolifyProject.name,
      status: coolifyProject.status,
      rawData: coolifyProject.rawData,
      createdByMiniHost: isCoolifyResourceCreatedByMiniHost(coolifyProject.rawData)
    });
  };

  addProject(project.coolifyLink?.coolifyProject ?? null);

  for (const application of project.applications) {
    addProject(application.coolifyProject ?? null);
  }

  return Array.from(byId.values());
}
