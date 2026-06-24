import type { ProjectApplication, ProjectApplicationType, ProjectDatabase } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { buildConnectionUrl, decryptDatabasePassword } from "@/lib/server/project-database";
import type {
  ProjectApplicationEnvVar,
  ProjectApplicationFormInput,
  ProjectApplicationReadiness
} from "@/lib/types";

const SENSITIVE_ENV_PATTERNS = [
  "DATABASE_URL",
  "POSTGRES_PASSWORD",
  "API_KEY",
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "PRIVATE_KEY"
];

const GIT_APP_TYPES = new Set<ProjectApplicationType>([
  "FRONTEND",
  "BACKEND",
  "FULLSTACK",
  "STATIC",
  "DOCKERFILE",
  "OTHER"
]);

export function slugifyApplicationName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function isSensitiveEnvKey(key: string) {
  const normalized = key.trim().toUpperCase();

  return SENSITIVE_ENV_PATTERNS.some((pattern) => normalized === pattern || normalized.includes(pattern));
}

export function normalizeEnvVariables(variables: ProjectApplicationEnvVar[] = []) {
  const seen = new Set<string>();
  const normalized: ProjectApplicationEnvVar[] = [];

  for (const variable of variables) {
    const key = variable.key.trim();
    const value = variable.value ?? "";

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push({ key, value });
  }

  return normalized;
}

export function encryptEnvironmentVariables(variables: ProjectApplicationEnvVar[]) {
  const normalized = normalizeEnvVariables(variables);

  if (normalized.length === 0) {
    return null;
  }

  return encryptSecret(JSON.stringify(normalized));
}

export function decryptEnvironmentVariables(encrypted?: string | null): ProjectApplicationEnvVar[] {
  if (!encrypted) {
    return [];
  }

  try {
    const parsed = JSON.parse(decryptSecret(encrypted)) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeEnvVariables(
      parsed
        .filter((item): item is ProjectApplicationEnvVar => {
          return Boolean(
            item &&
              typeof item === "object" &&
              "key" in item &&
              "value" in item &&
              typeof item.key === "string" &&
              typeof item.value === "string"
          );
        })
        .map((item) => ({ key: item.key, value: item.value }))
    );
  } catch {
    return [];
  }
}

export function buildEnvContent(variables: ProjectApplicationEnvVar[]) {
  return normalizeEnvVariables(variables)
    .map((variable) => `${variable.key}=${JSON.stringify(variable.value)}`)
    .join("\n");
}

export function buildDatabaseEnvVariables(database: ProjectDatabase): ProjectApplicationEnvVar[] {
  const password = decryptDatabasePassword(database.databasePasswordEncrypted);
  const databaseUrl = buildConnectionUrl(
    database.databaseUser,
    password,
    database.host,
    database.port,
    database.databaseName
  );

  return [
    { key: "DATABASE_URL", value: databaseUrl },
    { key: "POSTGRES_HOST", value: database.host },
    { key: "POSTGRES_PORT", value: String(database.port) },
    { key: "POSTGRES_DB", value: database.databaseName },
    { key: "POSTGRES_USER", value: database.databaseUser },
    { key: "POSTGRES_PASSWORD", value: password }
  ];
}

export function mergeEnvVariables(
  currentVariables: ProjectApplicationEnvVar[],
  incomingVariables: ProjectApplicationEnvVar[]
) {
  const values = new Map<string, ProjectApplicationEnvVar>();

  for (const variable of normalizeEnvVariables(currentVariables)) {
    values.set(variable.key, variable);
  }

  for (const variable of normalizeEnvVariables(incomingVariables)) {
    values.set(variable.key, variable);
  }

  return Array.from(values.values());
}

export function sanitizeProjectApplicationForAudit(application: ProjectApplication | Record<string, unknown>) {
  const { environmentVariablesEncrypted, environmentVariables, ...safe } =
    application as Record<string, unknown>;

  return {
    ...safe,
    hasEnvironmentVariables: Boolean(environmentVariablesEncrypted) || Array.isArray(environmentVariables)
  };
}

export function sanitizeEnvVariablesForAudit(variables: ProjectApplicationEnvVar[]) {
  return normalizeEnvVariables(variables).map((variable) => ({
    key: variable.key,
    isSensitive: isSensitiveEnvKey(variable.key),
    hasValue: variable.value.length > 0
  }));
}

export function calculateApplicationReadiness(
  application: Pick<
    ProjectApplication,
    | "name"
    | "type"
    | "gitRepository"
    | "gitBranch"
    | "domain"
    | "port"
    | "buildCommand"
    | "startCommand"
    | "projectDatabaseId"
    | "coolifyApplicationId"
  >,
  variables: ProjectApplicationEnvVar[]
): ProjectApplicationReadiness {
  const type = application.type;
  const requiresGit = GIT_APP_TYPES.has(type);
  const requiresPort = type === "BACKEND" || type === "FULLSTACK";
  const requiresBuild = type === "FRONTEND" || type === "FULLSTACK" || type === "STATIC";
  const requiresStart = type === "BACKEND" || type === "FULLSTACK" || type === "DOCKERFILE";
  const hasDatabaseUrl = variables.some((variable) => variable.key === "DATABASE_URL" && variable.value.trim());

  const checks = {
    hasName: Boolean(application.name.trim()),
    hasRepository: !requiresGit || Boolean(application.gitRepository?.trim()),
    hasBranch: !requiresGit || Boolean(application.gitBranch?.trim()),
    hasDomain: Boolean(application.domain?.trim()),
    hasPort: !requiresPort || Boolean(application.port && application.port > 0),
    hasBuildCommand: !requiresBuild || Boolean(application.buildCommand?.trim()),
    hasStartCommand: !requiresStart || Boolean(application.startCommand?.trim()),
    hasDatabaseUrl: !application.projectDatabaseId || Boolean(hasDatabaseUrl),
    hasCoolifyLink: Boolean(application.coolifyApplicationId)
  };

  const issues: string[] = [];

  if (!checks.hasName) {
    issues.push("Informe o nome da aplicação.");
  }

  if (!checks.hasRepository) {
    issues.push("Informe o repositório Git.");
  }

  if (!checks.hasBranch) {
    issues.push("Informe a branch Git.");
  }

  if (!checks.hasPort) {
    issues.push("Informe a porta da aplicação.");
  }

  if (!checks.hasBuildCommand) {
    issues.push("Informe o build command.");
  }

  if (!checks.hasStartCommand) {
    issues.push("Informe o start command.");
  }

  if (!checks.hasDatabaseUrl) {
    issues.push("Importe as variáveis do banco para configurar DATABASE_URL.");
  }

  return {
    ready: issues.length === 0,
    issues,
    checks
  };
}

export function normalizeProjectApplicationInput(input: Partial<ProjectApplicationFormInput>) {
  const type = (input.type ?? "FULLSTACK") as ProjectApplicationType;
  const name = String(input.name ?? "").trim();
  const slug = slugifyApplicationName(String(input.slug ?? name));
  const rawPort = input.port === "" || input.port === null || input.port === undefined ? null : Number(input.port);

  return {
    name,
    slug,
    type,
    gitRepository: input.gitRepository?.trim() || null,
    gitBranch: input.gitBranch?.trim() || (type === "DOCKER_COMPOSE" ? null : "main"),
    rootDirectory: input.rootDirectory?.trim() || null,
    buildCommand: input.buildCommand?.trim() || null,
    startCommand: input.startCommand?.trim() || null,
    installCommand: input.installCommand?.trim() || null,
    outputDirectory: input.outputDirectory?.trim() || null,
    port: Number.isFinite(rawPort) && rawPort && rawPort > 0 ? rawPort : null,
    domain: input.domain?.trim().toLowerCase() || null,
    notes: input.notes?.trim() || null,
    projectDatabaseId: input.projectDatabaseId?.trim() || null,
    dnsRecordId: input.dnsRecordId?.trim() || null,
    environmentVariables: normalizeEnvVariables(input.environmentVariables ?? [])
  };
}

export function validateProjectApplicationInput(input: ReturnType<typeof normalizeProjectApplicationInput>) {
  const errors: string[] = [];
  const validTypes: ProjectApplicationType[] = [
    "FRONTEND",
    "BACKEND",
    "FULLSTACK",
    "STATIC",
    "DOCKERFILE",
    "DOCKER_COMPOSE",
    "OTHER"
  ];

  if (!input.name) {
    errors.push("Informe o nome da aplicação.");
  }

  if (!input.slug) {
    errors.push("Informe um slug válido para a aplicação.");
  }

  if (!validTypes.includes(input.type)) {
    errors.push("Tipo de aplicação inválido.");
  }

  if (input.port !== null && (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535)) {
    errors.push("Porta deve estar entre 1 e 65535.");
  }

  if (input.domain && /\s/.test(input.domain)) {
    errors.push("Domínio da aplicação não pode ter espaço.");
  }

  return errors;
}
