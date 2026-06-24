"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  Rocket,
  Sparkles,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { pageContainerClass } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { apiRequest } from "@/lib/api-client";
import { maskEnvValueForPreview } from "@/lib/coolify-provision";
import {
  buildStaticPublishConfirmationText,
  slugifyPublishValue,
  type StaticPublishDnsMode,
  type StaticPublishCoolifyProjectMode,
  type StaticPublishInput,
  type StaticPublishStepResult
} from "@/lib/publish";
import type {
  CoolifyProjectCache,
  CoolifyServerCache,
  DnsRecord,
  Domain,
  MiniHostSettings,
  Project,
  ProjectApplication,
  ProjectApplicationEnvVar
} from "@/lib/types";

type SettingsResponse = {
  settings: MiniHostSettings;
  coolify?: { hasCredential: boolean };
  cloudflareConfigured?: boolean;
};
type DomainsResponse = { domains: Domain[] };
type RecordsResponse = { records: DnsRecord[] };
type CoolifyResponse = {
  servers: CoolifyServerCache[];
  projects: CoolifyProjectCache[];
  coolify?: { hasCredential: boolean; baseUrl?: string };
};
type PublishResponse = {
  success: boolean;
  message: string;
  steps: StaticPublishStepResult[];
  project?: Project;
  dnsRecord?: DnsRecord;
  application?: ProjectApplication;
  siteUrl?: string;
  coolifyUrl?: string;
  failedStepId?: string;
  nextActions?: string[];
};

type Phase = "form" | "executing" | "result";
type ToastState = { type: "success" | "error" | "info"; message: string } | null;

const fieldClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-zinc-50";

function isSensitiveEnvKey(key: string) {
  const upper = key.toUpperCase();
  return ["DATABASE_URL", "POSTGRES_PASSWORD", "API_KEY", "SECRET", "TOKEN", "PASSWORD", "PRIVATE_KEY"].some(
    (part) => upper === part || upper.includes(part)
  );
}

function buildRecordFqdn(record: DnsRecord, domains: Domain[]) {
  const domainName = domains.find((domain) => domain.id === record.domainId)?.name ?? "";

  if (!domainName) {
    return record.name;
  }

  if (!record.name || record.name === "@") {
    return domainName;
  }

  return record.name.endsWith(`.${domainName}`) ? record.name : `${record.name}.${domainName}`;
}

function stepIcon(status: StaticPublishStepResult["status"]) {
  if (status === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-rose-600" />;
  }

  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-violet-600" />;
  }

  if (status === "skipped") {
    return <Check className="h-4 w-4 text-zinc-400" />;
  }

  return <Circle className="h-4 w-4 text-zinc-300" />;
}

function stepStatusLabel(status: StaticPublishStepResult["status"]) {
  if (status === "success") {
    return "Sucesso";
  }

  if (status === "error") {
    return "Erro";
  }

  if (status === "running") {
    return "Executando";
  }

  if (status === "skipped") {
    return "Ignorado";
  }

  return "Pendente";
}

export function PublishPage() {
  const [phase, setPhase] = useState<Phase>("form");
  const [settings, setSettings] = useState<MiniHostSettings | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [coolifyServers, setCoolifyServers] = useState<CoolifyServerCache[]>([]);
  const [coolifyProjects, setCoolifyProjects] = useState<CoolifyProjectCache[]>([]);
  const [hasCoolifyCredential, setHasCoolifyCredential] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [wasCopied, setWasCopied] = useState(false);
  const [result, setResult] = useState<PublishResponse | null>(null);

  const [projectName, setProjectName] = useState("");
  const [projectSlug, setProjectSlug] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  const [dnsMode, setDnsMode] = useState<StaticPublishDnsMode>("create");
  const [fqdn, setFqdn] = useState("");
  const [dnsDomainId, setDnsDomainId] = useState("");
  const [dnsType, setDnsType] = useState<"A" | "CNAME">("A");
  const [dnsName, setDnsName] = useState("portfolio");
  const [dnsValue, setDnsValue] = useState("");
  const [dnsProxied, setDnsProxied] = useState(true);
  const [existingRecordId, setExistingRecordId] = useState("");

  const [appName, setAppName] = useState("");
  const [appSlug, setAppSlug] = useState("");
  const [gitRepository, setGitRepository] = useState("");
  const [gitBranch, setGitBranch] = useState("main");
  const [installCommand, setInstallCommand] = useState("npm install");
  const [buildCommand, setBuildCommand] = useState("npm run build");
  const [outputDirectory, setOutputDirectory] = useState("/dist");
  const [environmentVariables, setEnvironmentVariables] = useState<ProjectApplicationEnvVar[]>([]);

  const [coolifyServerId, setCoolifyServerId] = useState("");
  const [coolifyProjectMode, setCoolifyProjectMode] = useState<StaticPublishCoolifyProjectMode>("create");
  const [coolifyProjectName, setCoolifyProjectName] = useState("");
  const [coolifyProjectDescription, setCoolifyProjectDescription] = useState("");
  const [coolifyProjectId, setCoolifyProjectId] = useState("");
  const [createInCoolify, setCreateInCoolify] = useState(true);
  const [applyEnvsAfterCreate, setApplyEnvsAfterCreate] = useState(false);
  const [deployAfterCreate, setDeployAfterCreate] = useState(true);
  const [syncAfterDeploy, setSyncAfterDeploy] = useState(true);

  const activeRecords = useMemo(
    () => records.filter((record) => record.status !== "DELETED"),
    [records]
  );
  const activeCoolifyServers = useMemo(
    () => coolifyServers.filter((server) => server.status === "ACTIVE"),
    [coolifyServers]
  );
  const activeCoolifyProjects = useMemo(
    () => coolifyProjects.filter((project) => project.status === "ACTIVE"),
    [coolifyProjects]
  );
  const selectedDomain = domains.find((domain) => domain.id === dnsDomainId);
  const expectedConfirmation = projectSlug ? buildStaticPublishConfirmationText(projectSlug) : "";
  const isValidConfirmation = confirmationText === expectedConfirmation;

  const computedFqdnPreview = useMemo(() => {
    if (dnsMode === "existing" && existingRecordId) {
      const record = activeRecords.find((item) => item.id === existingRecordId);
      return record ? buildRecordFqdn(record, domains) : "";
    }

    if (dnsMode === "create" && selectedDomain) {
      const name = dnsName.trim() || "@";
      if (name === "@" || name === selectedDomain.name) {
        return selectedDomain.name;
      }

      if (name.endsWith(`.${selectedDomain.name}`)) {
        return name;
      }

      return `${name}.${selectedDomain.name}`;
    }

    return fqdn;
  }, [dnsMode, existingRecordId, activeRecords, domains, selectedDomain, dnsName, fqdn]);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [settingsData, domainsData, recordsData, coolifyData] = await Promise.all([
          apiRequest<SettingsResponse>("/api/settings"),
          apiRequest<DomainsResponse>("/api/domains"),
          apiRequest<RecordsResponse>("/api/records"),
          apiRequest<CoolifyResponse>("/api/coolify")
        ]);

        setSettings(settingsData.settings);
        setDomains(domainsData.domains);
        setRecords(recordsData.records);
        setCoolifyServers(coolifyData.servers);
        setCoolifyProjects(coolifyData.projects);
        setHasCoolifyCredential(Boolean(settingsData.coolify?.hasCredential ?? coolifyData.coolify?.hasCredential));
        setDnsValue(settingsData.settings.defaultVpsIp ?? "");
        setDnsProxied(Boolean(settingsData.settings.defaultProxyEnabled));
        setDnsDomainId(domainsData.domains[0]?.id ?? "");
        setCoolifyServerId(coolifyData.servers.find((server) => server.status === "ACTIVE")?.id ?? "");
        setCoolifyProjectId(coolifyData.projects.find((project) => project.status === "ACTIVE")?.id ?? "");
      } catch (requestError) {
        setToast({
          type: "error",
          message: requestError instanceof Error ? requestError.message : "Não foi possível carregar dados para publicação."
        });
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), toast.type === "error" ? 6500 : 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    setApplyEnvsAfterCreate(environmentVariables.length > 0);
  }, [environmentVariables.length]);

  useEffect(() => {
    if (coolifyProjectMode === "create") {
      setCoolifyProjectName(projectName);
      setCoolifyProjectDescription(projectDescription);
    }
  }, [projectName, projectDescription, coolifyProjectMode]);

  useEffect(() => {
    if (dnsMode === "create" || dnsMode === "existing") {
      setFqdn(computedFqdnPreview);
    }
  }, [computedFqdnPreview, dnsMode]);

  function updateEnv(index: number, key: keyof ProjectApplicationEnvVar, value: string) {
    const next = [...environmentVariables];
    next[index] = { ...next[index], [key]: value };
    setEnvironmentVariables(next);
  }

  function buildPayload(): StaticPublishInput {
    return {
      confirmationText,
      project: {
        name: projectName,
        slug: projectSlug,
        description: projectDescription || undefined
      },
      dns: {
        mode: dnsMode,
        fqdn: dnsMode === "skip" ? fqdn || undefined : computedFqdnPreview || fqdn,
        domainId: dnsMode === "create" ? dnsDomainId : undefined,
        type: dnsType,
        name: dnsName,
        value: dnsValue,
        proxied: dnsProxied,
        ttl: "auto",
        recordId: dnsMode === "existing" ? existingRecordId : undefined
      },
      application: {
        name: appName,
        slug: appSlug,
        gitRepository,
        gitBranch,
        installCommand,
        buildCommand,
        outputDirectory,
        environmentVariables
      },
      coolify: {
        createApplication: createInCoolify,
        serverId: coolifyServerId,
        projectMode: coolifyProjectMode,
        projectId: coolifyProjectMode === "existing" ? coolifyProjectId : undefined,
        projectName: coolifyProjectMode === "create" ? coolifyProjectName : undefined,
        projectDescription: coolifyProjectMode === "create" ? coolifyProjectDescription || undefined : undefined,
        applyEnvsAfterCreate,
        deployAfterCreate,
        syncAfterDeploy
      }
    };
  }

  async function handlePublish() {
    if (!isValidConfirmation) {
      setToast({ type: "error", message: `Digite exatamente: ${expectedConfirmation}` });
      return;
    }

    try {
      setIsSubmitting(true);
      setPhase("executing");
      const response = await apiRequest<PublishResponse>("/api/publish/static", {
        method: "POST",
        body: JSON.stringify(buildPayload())
      });
      setResult(response);
      setPhase("result");
      setToast({
        type: response.success ? "success" : "error",
        message: response.message
      });
    } catch (requestError) {
      setPhase("form");
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível executar a publicação."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyConfirmationText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setWasCopied(true);
      window.setTimeout(() => setWasCopied(false), 2000);
    } catch {
      setWasCopied(false);
    }
  }

  if (isLoading) {
    return (
      <div className={pageContainerClass}>
        <p className="text-sm text-zinc-500">Carregando assistente de publicação...</p>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className={pageContainerClass}>
        {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-soft">
          <div className="flex items-start gap-4">
            <div className={`rounded-full p-3 ${result.success ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {result.success ? <CheckCircle2 className="h-6 w-6" /> : <AlertCircle className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-zinc-950">
                {result.success ? "Publicação iniciada com sucesso" : "Publicação interrompida"}
              </h1>
              <p className="mt-2 text-sm text-zinc-600">{result.message}</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {result.steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
                {stepIcon(step.status)}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-zinc-900">{step.label}</p>
                    <Badge variant={step.status === "error" ? "danger" : step.status === "success" ? "success" : "muted"}>
                      {stepStatusLabel(step.status)}
                    </Badge>
                  </div>
                  {step.message ? <p className="mt-1 text-xs text-zinc-500">{step.message}</p> : null}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {result.project ? (
              <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-950">Projeto</p>
                <p className="mt-1">{result.project.name}</p>
              </div>
            ) : null}
            {result.application ? (
              <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-950">Aplicação</p>
                <p className="mt-1">{result.application.name}</p>
                <p className="mt-1 text-xs text-zinc-500">Status: {result.application.status}</p>
              </div>
            ) : null}
            {result.siteUrl ? (
              <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-700">
                <p className="font-semibold text-zinc-950">Domínio final</p>
                <a href={result.siteUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-violet-700 hover:underline">
                  {result.siteUrl}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {result.project ? (
              <Link
                href={`/projects/${result.project.id}`}
                className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Abrir projeto
              </Link>
            ) : null}
            {result.coolifyUrl ? (
              <a
                href={result.coolifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
              >
                Abrir no Coolify
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setPhase("form");
                setResult(null);
                setConfirmationText("");
              }}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              Nova publicação
            </button>
          </div>

          {result.nextActions?.length ? (
            <div className="mt-6">
              <Notice type="info" message={result.nextActions.join(" ")} />
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (phase === "executing") {
    return (
      <div className={pageContainerClass}>
        <section className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-soft">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-violet-600" />
          <h1 className="mt-4 text-xl font-semibold text-zinc-950">Executando publicação...</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Criando projeto, DNS, aplicação e iniciando deploy no Coolify. Isso pode levar alguns instantes.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className={pageContainerClass}>
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white p-6 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-violet-600 p-3 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-zinc-950">Publicar página estática</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              Publique uma página estática preenchendo os dados uma vez. O MiniHost cria o projeto, configura DNS,
              cria a aplicação no Coolify e inicia o deploy.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 space-y-6">
        <WizardCard title="A) Projeto" subtitle="Informações básicas do projeto MiniHost">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Nome do projeto</span>
              <input
                value={projectName}
                onChange={(event) => {
                  const name = event.target.value;
                  setProjectName(name);
                  if (!projectSlug) {
                    setProjectSlug(slugifyPublishValue(name));
                  }
                }}
                className={fieldClass}
                placeholder="Portfolio"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Slug do projeto</span>
              <input
                value={projectSlug}
                onChange={(event) => setProjectSlug(slugifyPublishValue(event.target.value))}
                className={fieldClass}
                placeholder="portfolio"
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-zinc-700">Descrição (opcional)</span>
              <textarea
                value={projectDescription}
                onChange={(event) => setProjectDescription(event.target.value)}
                className={`${fieldClass} min-h-20`}
                placeholder="Site estático do portfólio"
              />
            </label>
          </div>
        </WizardCard>

        <WizardCard title="B) Domínio e DNS" subtitle="Configure o endereço público da página">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {([
                ["create", "Criar novo registro DNS"],
                ["existing", "Usar registro existente"],
                ["skip", "Não configurar DNS agora"]
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDnsMode(value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    dnsMode === value
                      ? "bg-violet-600 text-white"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {dnsMode !== "skip" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">Domínio final (FQDN)</span>
                <input value={fqdn} onChange={(event) => setFqdn(event.target.value)} className={fieldClass} placeholder="portfolio.exemplo.com" />
              </label>
            ) : (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">Domínio da aplicação (opcional)</span>
                <input value={fqdn} onChange={(event) => setFqdn(event.target.value)} className={fieldClass} placeholder="portfolio.exemplo.com" />
              </label>
            )}

            {dnsMode === "create" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-700">Domínio/zona Cloudflare</span>
                  <select value={dnsDomainId} onChange={(event) => setDnsDomainId(event.target.value)} className={fieldClass}>
                    <option value="">Selecione</option>
                    {domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-700">Tipo</span>
                  <select value={dnsType} onChange={(event) => setDnsType(event.target.value as "A" | "CNAME")} className={fieldClass}>
                    <option value="A">A</option>
                    <option value="CNAME">CNAME</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-700">Nome/subdomínio</span>
                  <input value={dnsName} onChange={(event) => setDnsName(event.target.value)} className={fieldClass} placeholder="portfolio ou @" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-zinc-700">Valor/conteúdo</span>
                  <input value={dnsValue} onChange={(event) => setDnsValue(event.target.value)} className={fieldClass} placeholder={settings?.defaultVpsIp ?? "IP da VPS"} />
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 md:col-span-2">
                  <input type="checkbox" checked={dnsProxied} onChange={(event) => setDnsProxied(event.target.checked)} />
                  Proxy Cloudflare ativado
                </label>
              </div>
            ) : null}

            {dnsMode === "existing" ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-zinc-700">Registro DNS existente</span>
                <select value={existingRecordId} onChange={(event) => setExistingRecordId(event.target.value)} className={fieldClass}>
                  <option value="">Selecione</option>
                  {activeRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      {buildRecordFqdn(record, domains)} ({record.type})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </WizardCard>

        <WizardCard title="C) Aplicação Static" subtitle="Repositório público e comandos de build">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Nome da aplicação</span>
              <input
                value={appName}
                onChange={(event) => {
                  const name = event.target.value;
                  setAppName(name);
                  if (!appSlug) {
                    setAppSlug(slugifyPublishValue(name));
                  }
                }}
                className={fieldClass}
                placeholder="Portfolio Site"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Slug da aplicação</span>
              <input value={appSlug} onChange={(event) => setAppSlug(slugifyPublishValue(event.target.value))} className={fieldClass} placeholder="portfolio-site" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-zinc-700">Repositório Git público HTTPS</span>
              <input value={gitRepository} onChange={(event) => setGitRepository(event.target.value)} className={fieldClass} placeholder="https://github.com/user/repo" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Branch</span>
              <input value={gitBranch} onChange={(event) => setGitBranch(event.target.value)} className={fieldClass} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Install command</span>
              <input value={installCommand} onChange={(event) => setInstallCommand(event.target.value)} className={fieldClass} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Build command</span>
              <input value={buildCommand} onChange={(event) => setBuildCommand(event.target.value)} className={fieldClass} />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-700">Output directory</span>
              <input value={outputDirectory} onChange={(event) => setOutputDirectory(event.target.value)} className={fieldClass} placeholder="/dist" />
            </label>
          </div>

          <div className="mt-5 rounded-lg border border-zinc-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-zinc-950">Variáveis de ambiente (opcional)</p>
                <p className="text-sm text-zinc-500">Valores sensíveis são mascarados no preview.</p>
              </div>
              <button
                type="button"
                onClick={() => setEnvironmentVariables((current) => [...current, { key: "", value: "" }])}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <Plus className="h-4 w-4" />
                Variável
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {environmentVariables.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma variável adicionada.</p>
              ) : (
                environmentVariables.map((variable, index) => (
                  <div key={index} className="grid gap-3 md:grid-cols-[220px_1fr_auto]">
                    <input value={variable.key} onChange={(event) => updateEnv(index, "key", event.target.value)} className={fieldClass} placeholder="NOME" />
                    <input
                      value={variable.value}
                      onChange={(event) => updateEnv(index, "value", event.target.value)}
                      className={fieldClass}
                      type={isSensitiveEnvKey(variable.key) ? "password" : "text"}
                    />
                    <button
                      type="button"
                      onClick={() => setEnvironmentVariables((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="inline-flex h-10 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </WizardCard>

        <WizardCard title="D) Coolify" subtitle="Onde a aplicação será criada e publicada">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={createInCoolify} onChange={(event) => setCreateInCoolify(event.target.checked)} />
              Criar aplicação no Coolify
            </label>
            {createInCoolify ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {([
                    ["create", "Criar novo projeto Coolify"],
                    ["existing", "Usar projeto existente"]
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCoolifyProjectMode(value)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        coolifyProjectMode === value
                          ? "bg-violet-600 text-white"
                          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-zinc-700">Servidor Coolify</span>
                    <select value={coolifyServerId} onChange={(event) => setCoolifyServerId(event.target.value)} className={fieldClass}>
                      <option value="">Selecione</option>
                      {activeCoolifyServers.map((server) => (
                        <option key={server.id} value={server.id}>
                          {server.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {coolifyProjectMode === "create" ? (
                    <>
                      <label className="space-y-2">
                        <span className="text-sm font-medium text-zinc-700">Nome do projeto Coolify</span>
                        <input
                          value={coolifyProjectName}
                          onChange={(event) => setCoolifyProjectName(event.target.value)}
                          className={fieldClass}
                          placeholder={projectName || "Portfolio"}
                        />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="text-sm font-medium text-zinc-700">Descrição do projeto Coolify (opcional)</span>
                        <input
                          value={coolifyProjectDescription}
                          onChange={(event) => setCoolifyProjectDescription(event.target.value)}
                          className={fieldClass}
                          placeholder={projectDescription || "Projeto criado pelo MiniHost"}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="space-y-2">
                      <span className="text-sm font-medium text-zinc-700">Projeto Coolify</span>
                      <select value={coolifyProjectId} onChange={(event) => setCoolifyProjectId(event.target.value)} className={fieldClass}>
                        <option value="">Selecione</option>
                        {activeCoolifyProjects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={applyEnvsAfterCreate}
                    disabled={environmentVariables.length === 0}
                    onChange={(event) => setApplyEnvsAfterCreate(event.target.checked)}
                  />
                  Aplicar envs após criar {environmentVariables.length === 0 ? "(sem variáveis)" : ""}
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={deployAfterCreate} onChange={(event) => setDeployAfterCreate(event.target.checked)} />
                  Iniciar deploy após criar
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input type="checkbox" checked={syncAfterDeploy} onChange={(event) => setSyncAfterDeploy(event.target.checked)} />
                  Sincronizar status após deploy
                </label>
              </>
            ) : null}
            {!hasCoolifyCredential ? (
              <Notice type="info" message="Configure o Coolify em Configurações para habilitar a publicação automática." />
            ) : null}
          </div>
        </WizardCard>

        <WizardCard title="E) Revisão" subtitle="Confira tudo antes de executar">
          <div className="grid gap-4 md:grid-cols-2">
            <PreviewBlock title="Projeto" items={[`Nome: ${projectName || "-"}`, `Slug: ${projectSlug || "-"}`]} />
            <PreviewBlock
              title="DNS"
              items={[
                `Modo: ${dnsMode === "create" ? "Criar novo" : dnsMode === "existing" ? "Usar existente" : "Não configurar"}`,
                `FQDN: ${fqdn || computedFqdnPreview || "-"}`,
                dnsMode === "create" ? `Tipo: ${dnsType}` : "",
                dnsMode === "create" ? `Valor: ${dnsValue || "-"}` : "",
                dnsMode === "create" ? `Proxy: ${dnsProxied ? "sim" : "não"}` : ""
              ].filter(Boolean)}
            />
            <PreviewBlock
              title="Aplicação"
              items={[
                `Nome: ${appName || "-"}`,
                `Tipo: Static`,
                `Repo: ${gitRepository || "-"}`,
                `Branch: ${gitBranch}`,
                `Build: ${buildCommand}`,
                `Output: ${outputDirectory}`
              ]}
            />
            <PreviewBlock
              title="Coolify"
              items={[
                `Criar app: ${createInCoolify ? "sim" : "não"}`,
                `Servidor: ${activeCoolifyServers.find((server) => server.id === coolifyServerId)?.name ?? "-"}`,
                coolifyProjectMode === "create"
                  ? `Projeto: criar "${coolifyProjectName || projectName || "-"}"`
                  : `Projeto: usar "${activeCoolifyProjects.find((project) => project.id === coolifyProjectId)?.name ?? "-"}"`,
                `Deploy: ${deployAfterCreate ? "sim" : "não"}`
              ]}
            />
          </div>

          <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50 p-4">
            <p className="text-sm font-semibold text-violet-950">Variáveis</p>
            {environmentVariables.length === 0 ? (
              <p className="mt-2 text-sm text-violet-900">Nenhuma variável configurada.</p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-sm text-violet-950">
                {environmentVariables.map((variable) => (
                  <li key={variable.key}>
                    {variable.key} = {maskEnvValueForPreview(variable.key, variable.value, isSensitiveEnvKey)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <label htmlFor="publish-confirmation" className="block text-sm font-medium text-zinc-700">
              Confirmação
            </label>
            <p className="mt-1 text-xs text-zinc-500">
              Digite exatamente:{" "}
              <span className="inline-flex items-center gap-1">
                <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono">{expectedConfirmation || "publicar slug"}</code>
                <button type="button" onClick={() => void copyConfirmationText(expectedConfirmation)} className="text-violet-600">
                  {wasCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </span>
            </p>
            <input
              id="publish-confirmation"
              value={confirmationText}
              disabled={isSubmitting}
              onChange={(event) => setConfirmationText(event.target.value)}
              className={`${fieldClass} mt-2`}
              placeholder={expectedConfirmation}
              autoComplete="off"
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href="/projects" className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50">
              Modo avançado
            </Link>
            <button
              type="button"
              disabled={
                isSubmitting ||
                !isValidConfirmation ||
                !projectName ||
                !projectSlug ||
                !appName ||
                !gitRepository ||
                (createInCoolify && !coolifyServerId) ||
                (createInCoolify && coolifyProjectMode === "create" && !coolifyProjectName.trim()) ||
                (createInCoolify && coolifyProjectMode === "existing" && !coolifyProjectId)
              }
              onClick={() => void handlePublish()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Executar publicação
            </button>
          </div>
        </WizardCard>
      </div>
    </div>
  );
}

function WizardCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-soft">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function PreviewBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
      <p className="text-sm font-semibold text-zinc-950">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-zinc-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
