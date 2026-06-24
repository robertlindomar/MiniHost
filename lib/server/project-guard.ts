import { prisma } from "@/lib/prisma";
import { defaultSettings, toSettings } from "@/lib/server/mappers";
import { isProtectedDatabaseName, isProtectedDatabaseUser } from "@/lib/server/postgres-guard";
import { isCoolifyResourceCreatedByMiniHost } from "@/lib/server/coolify-resource";

export class ProjectGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectGuardError";
  }
}

const PROTECTED_PROJECT_SLUGS = new Set(["minihost"]);
const PROTECTED_APPLICATION_SLUGS = new Set(["minihost"]);

async function loadSettings() {
  const rows = await prisma.appSetting.findMany();
  return rows.length > 0 ? toSettings(rows) : defaultSettings;
}

type GuardProject = {
  id: string;
  slug: string;
  name: string;
  mainDomain?: string | null;
  status: string;
};

type GuardApplication = {
  id: string;
  slug: string;
  name: string;
  coolifyApplication?: {
    coolifyId: string;
    name: string;
    rawData?: unknown;
  } | null;
};

type GuardDatabase = {
  id: string;
  name: string;
  databaseName: string;
  databaseUser: string;
  status: string;
};

export function isPanelApexDnsRecord(
  record: { name: string },
  domainName: string,
  panelDomain?: string | null
) {
  if (!panelDomain) {
    return false;
  }

  const zone = domainName.trim().toLowerCase();
  const panel = panelDomain.trim().toLowerCase();

  if (zone !== panel) {
    return false;
  }

  const name = record.name.trim().toLowerCase();

  return name === "@" || name === "" || name === zone;
}

export function assertDnsRecordTerminationAllowed(
  record: { name: string; type: string },
  domainName: string,
  panelDomain?: string | null
) {
  if (!isPanelApexDnsRecord(record, domainName, panelDomain)) {
    return;
  }

  throw new ProjectGuardError(
    `O registro DNS ${record.type} ${record.name || "@"} é o domínio raiz do painel (${panelDomain}) e não pode ser excluído automaticamente.`
  );
}

export async function assertProjectTerminationAllowed(project: GuardProject) {
  if (PROTECTED_PROJECT_SLUGS.has(project.slug.trim().toLowerCase())) {
    throw new ProjectGuardError('O projeto "minihost" é protegido e não pode ser encerrado.');
  }

  if (project.status === "TERMINATING") {
    throw new ProjectGuardError("Este projeto já está em encerramento. Aguarde ou tente novamente as pendências.");
  }

  const settings = await loadSettings();

  if (project.mainDomain && settings.defaultDomain) {
    const mainDomain = project.mainDomain.trim().toLowerCase();
    const panelDomain = settings.defaultDomain.trim().toLowerCase();

    if (mainDomain === panelDomain) {
      throw new ProjectGuardError(
        "O domínio principal deste projeto é o domínio raiz do painel MiniHost. Encerramento bloqueado."
      );
    }
  }
}

export function assertApplicationTerminationAllowed(application: GuardApplication) {
  const slug = application.slug.trim().toLowerCase();

  if (PROTECTED_APPLICATION_SLUGS.has(slug) || slug.includes("minihost")) {
    throw new ProjectGuardError(
      `A aplicação "${application.name}" parece ser o próprio MiniHost e não pode ser removida automaticamente.`
    );
  }
}

export function assertDatabaseTerminationAllowed(database: GuardDatabase, adminUsername?: string) {
  if (isProtectedDatabaseName(database.databaseName)) {
    throw new ProjectGuardError(`O banco "${database.databaseName}" é protegido e não pode ser destruído.`);
  }

  if (isProtectedDatabaseUser(database.databaseUser, adminUsername)) {
    throw new ProjectGuardError(`O usuário "${database.databaseUser}" é protegido e não pode ser removido.`);
  }
}

export function assertCoolifyProjectDeletionAllowed(input: {
  coolifyProject: { name: string; rawData?: unknown };
  deleteCoolifyProject: boolean;
  confirmExternalRemoval?: boolean;
  createdByMiniHost?: boolean;
}) {
  if (!input.deleteCoolifyProject) {
    return;
  }

  const wasCreatedByMiniHost =
    input.createdByMiniHost ?? isCoolifyResourceCreatedByMiniHost(input.coolifyProject.rawData);

  if (!wasCreatedByMiniHost && !input.confirmExternalRemoval) {
    throw new ProjectGuardError(
      `O projeto Coolify "${input.coolifyProject.name}" não foi criado pelo MiniHost. Confirme explicitamente para remover.`
    );
  }
}
