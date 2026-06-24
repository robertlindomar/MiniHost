import type { DnsRecordType, ProjectApplicationEnvVar } from "@/lib/types";

export type StaticPublishDnsMode = "create" | "existing" | "skip";

export type StaticPublishStepId =
  | "project"
  | "dns"
  | "application"
  | "coolify_project"
  | "coolify_project_link"
  | "coolify_create"
  | "envs"
  | "deploy"
  | "sync"
  | "finished";

export type StaticPublishStepStatus = "pending" | "running" | "success" | "error" | "skipped";

export type StaticPublishStepResult = {
  id: StaticPublishStepId;
  label: string;
  status: StaticPublishStepStatus;
  message?: string;
};

export type StaticPublishCoolifyProjectMode = "create" | "existing";

export type StaticPublishInput = {
  confirmationText: string;
  project: {
    name: string;
    slug: string;
    description?: string;
  };
  dns: {
    mode: StaticPublishDnsMode;
    fqdn?: string;
    domainId?: string;
    type?: DnsRecordType;
    name?: string;
    value?: string;
    proxied?: boolean;
    ttl?: "auto" | number;
    recordId?: string;
  };
  application: {
    name: string;
    slug?: string;
    gitRepository: string;
    gitBranch?: string;
    installCommand?: string;
    buildCommand?: string;
    outputDirectory?: string;
    environmentVariables?: ProjectApplicationEnvVar[];
  };
  coolify: {
    createApplication: boolean;
    serverId?: string;
    projectMode?: StaticPublishCoolifyProjectMode;
    projectId?: string;
    projectName?: string;
    projectDescription?: string;
    applyEnvsAfterCreate?: boolean;
    deployAfterCreate?: boolean;
    syncAfterDeploy?: boolean;
  };
};

export function buildStaticPublishConfirmationText(projectSlug: string) {
  return `publicar ${projectSlug.trim().toLowerCase()}`;
}

export function slugifyPublishValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
