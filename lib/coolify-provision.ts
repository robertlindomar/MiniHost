import type { CreatePublicRepositoryApplicationPayload } from "@/lib/coolify";
import type { ProjectApplicationStatus, ProjectApplicationType } from "@/lib/types";
import { buildApplicationProvisionConfirmationText, buildApplyEnvsConfirmationText, buildDeployConfirmationText } from "@/lib/provision";

const GIT_COMPATIBLE_TYPES = new Set<ProjectApplicationType>([
  "FRONTEND",
  "BACKEND",
  "FULLSTACK",
  "STATIC",
  "DOCKERFILE",
  "OTHER"
]);

export { buildApplicationProvisionConfirmationText, buildApplyEnvsConfirmationText, buildDeployConfirmationText };

export function isGitCompatibleApplicationType(type: ProjectApplicationType) {
  return GIT_COMPATIBLE_TYPES.has(type);
}

export function isPublicGitRepository(repository?: string | null) {
  const value = repository?.trim();

  if (!value) {
    return false;
  }

  if (value.startsWith("git@") || value.startsWith("ssh://")) {
    return false;
  }

  if (value.includes("@")) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function mapApplicationTypeToBuildPack(
  type: ProjectApplicationType
): "nixpacks" | "static" | "dockerfile" | "dockercompose" {
  if (type === "STATIC") {
    return "static";
  }

  if (type === "DOCKERFILE") {
    return "dockerfile";
  }

  return "nixpacks";
}

export function normalizeCoolifyDomain(domain?: string | null) {
  const trimmed = domain?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function normalizeOptionalCommand(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const COOLIFY_DIRECTORY_PATH_PATTERN = /^\/([a-zA-Z0-9._\-\/~@+]*)?$/;

export function normalizeCoolifyDirectoryPath(value?: string | null, fallback?: string) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  const normalized =
    withoutTrailingSlash === "" || withoutTrailingSlash === "/"
      ? "/"
      : `/${withoutTrailingSlash.replace(/^\/+/, "")}`;

  if (!COOLIFY_DIRECTORY_PATH_PATTERN.test(normalized)) {
    return fallback;
  }

  return normalized;
}

function normalizeBaseDirectory(value?: string | null) {
  const normalized = normalizeCoolifyDirectoryPath(value);

  if (!normalized || normalized === "/") {
    return undefined;
  }

  return normalized;
}

export type CoolifyCreateApplicationInput = {
  name: string;
  type: ProjectApplicationType;
  gitRepository: string;
  gitBranch: string;
  rootDirectory?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
  installCommand?: string | null;
  outputDirectory?: string | null;
  port?: number | null;
  domain?: string | null;
};

export function buildCoolifyCreatePayload(
  application: CoolifyCreateApplicationInput,
  coolifyServerCoolifyId: string,
  coolifyProjectCoolifyId: string
): CreatePublicRepositoryApplicationPayload {
  const type = application.type;
  const buildPack = mapApplicationTypeToBuildPack(type);
  const isStatic = type === "STATIC";

  const publishDirectory = isStatic
    ? normalizeCoolifyDirectoryPath(application.outputDirectory, "/dist")
    : normalizeCoolifyDirectoryPath(application.outputDirectory);

  const payload: CreatePublicRepositoryApplicationPayload = {
    project_uuid: coolifyProjectCoolifyId,
    server_uuid: coolifyServerCoolifyId,
    environment_name: "production",
    git_repository: application.gitRepository.trim(),
    git_branch: application.gitBranch.trim(),
    build_pack: buildPack,
    ports_exposes: isStatic ? "80" : application.port && application.port > 0 ? String(application.port) : "3000",
    name: application.name,
    domains: normalizeCoolifyDomain(application.domain),
    install_command: normalizeOptionalCommand(application.installCommand),
    build_command: normalizeOptionalCommand(application.buildCommand),
    base_directory: normalizeBaseDirectory(application.rootDirectory),
    instant_deploy: false,
    is_auto_deploy_enabled: false,
    is_static: isStatic
  };

  if (publishDirectory) {
    payload.publish_directory = publishDirectory;
  }

  if (!isStatic) {
    const startCommand = normalizeOptionalCommand(application.startCommand);

    if (startCommand) {
      payload.start_command = startCommand;
    }
  }

  return payload;
}

export function buildCoolifyApplicationUrl(
  baseUrl: string,
  projectCoolifyId: string,
  applicationCoolifyId: string
) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  return `${normalized}/project/${projectCoolifyId}/environment/production/application/${applicationCoolifyId}`;
}

export type CanCreateInCoolifyInput = {
  status: ProjectApplicationStatus;
  type: ProjectApplicationType;
  gitRepository?: string | null;
  gitBranch?: string | null;
  coolifyApplicationId?: string | null;
  coolifyServerId?: string | null;
  coolifyProjectId?: string | null;
  hasCoolifyCredential: boolean;
  hasActiveServer: boolean;
  hasActiveProject: boolean;
  hasProjectCoolifyLink?: boolean;
  requireSelectedDestination?: boolean;
};

function collectCreateBlockers(input: CanCreateInCoolifyInput) {
  const reasons: string[] = [];

  if (!input.hasCoolifyCredential) {
    reasons.push("Configure a credencial do Coolify em Configurações.");
  }

  if (input.hasProjectCoolifyLink === false) {
    reasons.push("Crie ou vincule um projeto Coolify ao projeto MiniHost antes de provisionar aplicações.");
  }

  if (input.coolifyApplicationId) {
    reasons.push("Esta aplicação já possui vínculo com o Coolify.");
  }

  if (input.status === "LINKED" || input.status === "DEPLOYED" || input.status === "ENVS_APPLIED" || input.status === "DEPLOYING") {
    reasons.push("Aplicação já vinculada ou implantada no Coolify.");
  }

  if (input.status === "ARCHIVED") {
    reasons.push("Aplicações arquivadas não podem ser criadas no Coolify.");
  }

  if (!isGitCompatibleApplicationType(input.type)) {
    reasons.push("Tipo de aplicação incompatível com repositório Git público.");
  }

  if (!input.gitRepository?.trim()) {
    reasons.push("Informe o repositório Git.");
  } else if (!isPublicGitRepository(input.gitRepository)) {
    reasons.push("Somente repositórios públicos via HTTPS são suportados nesta etapa.");
  }

  if (!input.gitBranch?.trim()) {
    reasons.push("Informe a branch Git.");
  }

  if (!input.hasActiveServer) {
    reasons.push("Sincronize pelo menos um servidor Coolify ativo.");
  }

  if (!input.hasActiveProject) {
    reasons.push("Sincronize ou selecione um projeto Coolify ativo.");
  }

  if (input.requireSelectedDestination !== false) {
    if (!input.coolifyServerId) {
      reasons.push("Selecione um servidor Coolify.");
    }

    if (!input.coolifyProjectId) {
      reasons.push("Selecione um projeto Coolify.");
    }
  }

  const allowedStatus = input.status === "READY" || input.status === "DRAFT" || input.status === "FAILED";

  if (!allowedStatus) {
    reasons.push("Status atual não permite criação no Coolify.");
  }

  return reasons;
}

export function canCreateInCoolify(input: CanCreateInCoolifyInput) {
  const reasons = collectCreateBlockers({ ...input, requireSelectedDestination: true });

  return {
    allowed: reasons.length === 0,
    reasons
  };
}

export function canShowCreateInCoolifyButton(input: CanCreateInCoolifyInput) {
  const reasons = collectCreateBlockers({ ...input, requireSelectedDestination: false });

  return {
    allowed: reasons.length === 0,
    reasons
  };
}

export function maskEnvValueForPreview(key: string, value: string, isSensitive: (key: string) => boolean) {
  if (isSensitive(key)) {
    return "********";
  }

  return value || "-";
}

export type CoolifyPostProvisionInput = {
  coolifyApplicationId?: string | null;
  coolifyApplicationStatus?: string | null;
  coolifyServerStatus?: string | null;
  coolifyProjectStatus?: string | null;
  environmentVariableCount: number;
  applicationStatus: ProjectApplicationStatus;
};

function hasActiveCoolifyResource(status?: string | null) {
  return status === "ACTIVE";
}

function hasBlockedCoolifyResource(status?: string | null) {
  return status === "REMOVED" || status === "MISSING";
}

export function canShowApplyEnvsButton(input: CoolifyPostProvisionInput) {
  const reasons: string[] = [];

  if (!input.coolifyApplicationId) {
    reasons.push("Crie ou vincule a aplicação no Coolify antes de aplicar variáveis.");
  }

  if (input.environmentVariableCount === 0) {
    reasons.push("Não há variáveis planejadas para aplicar.");
  }

  if (!hasActiveCoolifyResource(input.coolifyApplicationStatus)) {
    reasons.push("Aplicação Coolify ausente ou inativa. Sincronize novamente.");
  }

  if (hasBlockedCoolifyResource(input.coolifyServerStatus) || hasBlockedCoolifyResource(input.coolifyProjectStatus)) {
    reasons.push("Recursos Coolify vinculados estão ausentes ou removidos.");
  }

  if (input.applicationStatus === "ARCHIVED") {
    reasons.push("Status atual não permite aplicar variáveis.");
  }

  return {
    allowed: reasons.length === 0,
    reasons
  };
}

export function canShowDeployButton(input: CoolifyPostProvisionInput) {
  const reasons: string[] = [];

  if (!input.coolifyApplicationId) {
    reasons.push("Crie ou vincule a aplicação no Coolify antes de iniciar deploy.");
  }

  if (!hasActiveCoolifyResource(input.coolifyApplicationStatus)) {
    reasons.push("Aplicação Coolify ausente ou inativa. Sincronize novamente.");
  }

  if (hasBlockedCoolifyResource(input.coolifyServerStatus) || hasBlockedCoolifyResource(input.coolifyProjectStatus)) {
    reasons.push("Recursos Coolify vinculados estão ausentes ou removidos.");
  }

  if (input.applicationStatus === "ARCHIVED") {
    reasons.push("Aplicações arquivadas não podem receber deploy.");
  }

  return {
    allowed: reasons.length === 0,
    reasons
  };
}
