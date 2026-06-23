"use client";

import { ArrowLeft, Link2, Unlink } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProjectDatabasesSection } from "@/components/projects/databases/ProjectDatabasesSection";
import { LinkRecordsDialog } from "@/components/projects/LinkRecordsDialog";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { DnsTemplatesPanel } from "@/components/templates/DnsTemplatesPanel";
import { DnsTypeBadge } from "@/components/records/DnsTypeBadge";
import { OriginBadge } from "@/components/records/OriginBadge";
import { ProxyBadge } from "@/components/records/ProxyBadge";
import { RecordStatusBadge } from "@/components/records/RecordStatusBadge";
import { DomainsLoadingState } from "@/components/domains/DomainsLoadingState";
import { Notice } from "@/components/ui/Notice";
import { Toast } from "@/components/ui/Toast";
import { pageContainerClass } from "@/components/layout/page-container";
import { apiRequest } from "@/lib/api-client";
import { formatDateTime, formatRecordValue } from "@/lib/format";
import type { DnsRecord, Domain, Project } from "@/lib/types";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;
type ProjectDetailResponse = { project: Project; records: DnsRecord[] };
type DomainsResponse = { domains: Domain[] };
type RecordsResponse = { records: DnsRecord[] };

function getDomainName(domains: Domain[], domainId: string) {
  return domains.find((domain) => domain.id === domainId)?.name ?? "Domínio removido";
}

function getFullRecordName(record: DnsRecord, domains: Domain[]) {
  const domainName = getDomainName(domains, record.domainId);

  if (!record.name || record.name === "@") {
    return domainName;
  }

  if (record.name.endsWith(`.${domainName}`)) {
    return record.name;
  }

  return `${record.name}.${domainName}`;
}

export function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [linkedRecords, setLinkedRecords] = useState<DnsRecord[]>([]);
  const [allRecords, setAllRecords] = useState<DnsRecord[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      setIsLoading(true);
      const [projectData, domainData, recordData] = await Promise.all([
        apiRequest<ProjectDetailResponse>(`/api/projects/${projectId}`),
        apiRequest<DomainsResponse>("/api/domains"),
        apiRequest<RecordsResponse>("/api/records")
      ]);

      setProject(projectData.project);
      setLinkedRecords(projectData.records);
      setDomains(domainData.domains);
      setAllRecords(recordData.records);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o projeto.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [projectId]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(
      () => setToast(null),
      toast.type === "error" ? 6500 : 4200
    );

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const isArchived = project?.status === "ARCHIVED";
  const linkedRecordIds = useMemo(() => linkedRecords.map((record) => record.id), [linkedRecords]);

  async function handleLinkRecords(recordIds: string[]) {
    try {
      setIsSubmitting(true);
      await apiRequest(`/api/projects/${projectId}/link-records`, {
        method: "POST",
        body: JSON.stringify({ recordIds })
      });
      setToast({ type: "success", message: "Registros vinculados ao projeto com sucesso." });
      setIsLinkDialogOpen(false);
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível vincular os registros."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUnlinkRecord(record: DnsRecord) {
    try {
      setIsSubmitting(true);
      await apiRequest(`/api/projects/${projectId}/unlink-record`, {
        method: "POST",
        body: JSON.stringify({ recordId: record.id })
      });
      setToast({ type: "success", message: "Registro desvinculado do projeto." });
      await reload();
    } catch (requestError) {
      setToast({
        type: "error",
        message: requestError instanceof Error ? requestError.message : "Não foi possível desvincular o registro."
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className={pageContainerClass}>
        <DomainsLoadingState />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={pageContainerClass}>
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition hover:text-blue-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para projetos
        </Link>
        <Notice type="error" message={error ?? "Projeto não encontrado."} />
      </div>
    );
  }

  return (
    <div className={pageContainerClass}>
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 transition hover:text-blue-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para projetos
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-zinc-950 md:text-3xl">{project.name}</h2>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-2 font-mono text-sm text-zinc-500">{project.slug}</p>
            {project.description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">{project.description}</p> : null}
          </div>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-medium text-zinc-600">Domínio principal</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{project.mainDomain || "Não definido"}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-medium text-zinc-600">Registros vinculados</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{linkedRecords.length}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-medium text-zinc-600">Criado em</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">{formatDateTime(project.createdAt)}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
          <p className="text-sm font-medium text-zinc-600">Arquivado em</p>
          <p className="mt-2 text-lg font-semibold text-zinc-950">
            {project.archivedAt ? formatDateTime(project.archivedAt) : "—"}
          </p>
        </div>
      </section>

      <ProjectDatabasesSection project={project} onChanged={() => void reload()} />

      {!isArchived ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-soft">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-zinc-950">Criar DNS por template</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Atalhos rápidos que criam registros já vinculados a este projeto.
            </p>
          </div>
          <DnsTemplatesPanel
            mode="quick"
            projectId={project.id}
            onRecordCreated={() => {
              setToast({ type: "success", message: "Registro criado e vinculado ao projeto." });
              void reload();
            }}
          />
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-zinc-950">Registros DNS vinculados</h3>
            <p className="mt-1 text-sm text-zinc-500">{linkedRecords.length} registro(s) neste projeto</p>
          </div>
          {!isArchived ? (
            <button
              type="button"
              onClick={() => setIsLinkDialogOpen(true)}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Link2 className="h-4 w-4" />
              Vincular DNS existente
            </button>
          ) : null}
        </div>

        {linkedRecords.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-zinc-500">Nenhum registro DNS vinculado a este projeto.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse">
              <thead className="bg-zinc-50">
                <tr className="text-left text-xs font-semibold text-zinc-500">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Conteúdo</th>
                  <th className="px-4 py-3">Proxy</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {linkedRecords.map((record) => {
                  const value = formatRecordValue(record);

                  return (
                    <tr key={record.id} className="text-sm text-zinc-700 transition hover:bg-zinc-50">
                      <td className="px-4 py-4">
                        <span className="block max-w-[260px] truncate font-semibold text-zinc-950">
                          {getFullRecordName(record, domains)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <DnsTypeBadge type={record.type} />
                      </td>
                      <td className="px-4 py-4">
                        <span title={value} className="block max-w-[280px] truncate text-zinc-700">
                          {value}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <ProxyBadge proxied={record.proxied} />
                      </td>
                      <td className="px-4 py-4">
                        <OriginBadge source={record.source} />
                      </td>
                      <td className="px-4 py-4">
                        <RecordStatusBadge record={record} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end">
                          {!isArchived ? (
                            <button
                              type="button"
                              onClick={() => void handleUnlinkRecord(record)}
                              disabled={isSubmitting}
                              className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                              Desvincular
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LinkRecordsDialog
        isOpen={isLinkDialogOpen}
        isSubmitting={isSubmitting}
        records={allRecords}
        domains={domains}
        linkedRecordIds={linkedRecordIds}
        onCancel={() => (isSubmitting ? undefined : setIsLinkDialogOpen(false))}
        onConfirm={(recordIds) => void handleLinkRecords(recordIds)}
      />
    </div>
  );
}
