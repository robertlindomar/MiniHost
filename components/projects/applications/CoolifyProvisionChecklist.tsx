"use client";

import { AlertCircle, CheckCircle2, Circle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ProjectApplication } from "@/lib/types";

type ChecklistStatus = "pending" | "success" | "error" | "skipped";

type ChecklistItem = {
  label: string;
  status: ChecklistStatus;
  detail?: string;
};

function statusIcon(status: ChecklistStatus) {
  if (status === "success" || status === "skipped") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-rose-600" />;
  }

  return <Circle className="h-4 w-4 text-zinc-400" />;
}

function statusLabel(status: ChecklistStatus) {
  if (status === "success") {
    return "Sucesso";
  }

  if (status === "skipped") {
    return "Sem variáveis";
  }

  if (status === "error") {
    return "Erro";
  }

  return "Pendente";
}

function buildChecklist(application: ProjectApplication): ChecklistItem[] {
  const hasCoolifyLink = Boolean(application.coolifyApplication?.id);
  const envCount = application.environmentVariables?.length ?? application.environmentVariableKeys?.length ?? 0;
  const hasEnvs = envCount > 0;

  let envStatus: ChecklistStatus = "pending";
  let envDetail: string | undefined;

  if (!hasCoolifyLink) {
    envStatus = "pending";
  } else if (!hasEnvs) {
    envStatus = "skipped";
    envDetail = "Sem variáveis para aplicar";
  } else if (application.lastEnvsApplyStatus === "FAILED") {
    envStatus = "error";
    envDetail = application.lastEnvsApplyMessage;
  } else if (application.envsAppliedAt || application.lastEnvsApplyStatus === "SUCCESS") {
    envStatus = "success";
    envDetail = application.envsAppliedAt ? formatDateTime(application.envsAppliedAt) : undefined;
  }

  let deployStatus: ChecklistStatus = "pending";
  let deployDetail: string | undefined;

  if (!hasCoolifyLink) {
    deployStatus = "pending";
  } else if (application.lastDeployStatus === "FAILED") {
    deployStatus = "error";
    deployDetail = application.lastDeployMessage;
  } else if (application.lastDeployStartedAt) {
    deployStatus = "success";
    deployDetail = formatDateTime(application.lastDeployStartedAt);
  }

  let syncStatus: ChecklistStatus = "pending";
  let syncDetail: string | undefined;

  if (!hasCoolifyLink) {
    syncStatus = "pending";
  } else if (application.lastCoolifySyncAt) {
    syncStatus = "success";
    syncDetail = formatDateTime(application.lastCoolifySyncAt);
  }

  let createStatus: ChecklistStatus = "pending";
  let createDetail: string | undefined;

  if (hasCoolifyLink) {
    createStatus = application.lastProvisionStatus === "FAILED" ? "error" : "success";
    createDetail = application.provisionedAt ? formatDateTime(application.provisionedAt) : undefined;

    if (application.lastProvisionStatus === "FAILED") {
      createDetail = application.lastProvisionMessage;
    }
  }

  return [
    {
      label: "Aplicação criada no Coolify",
      status: createStatus,
      detail: createDetail
    },
    {
      label: "Variáveis aplicadas",
      status: envStatus,
      detail: envDetail
    },
    {
      label: "Deploy iniciado",
      status: deployStatus,
      detail: deployDetail
    },
    {
      label: "Última sincronização concluída",
      status: syncStatus,
      detail: syncDetail
    }
  ];
}

export function CoolifyProvisionChecklist({ application }: { application: ProjectApplication }) {
  const items = buildChecklist(application);

  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-zinc-500" />
        <h4 className="font-semibold text-zinc-950">Fluxo de provisionamento</h4>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.label} className="flex items-start gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2.5">
            <span className="mt-0.5">{statusIcon(item.status)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-zinc-900">{item.label}</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                  {statusLabel(item.status)}
                </span>
              </div>
              {item.detail ? <p className="mt-1 text-xs text-zinc-500">{item.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
