"use client";

import { AlertCircle, Check, CheckCircle2, Circle, Loader2 } from "lucide-react";
import type { TerminateStepResult } from "@/lib/terminate";

function stepIcon(status: TerminateStepResult["status"]) {
  if (status === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (status === "error") {
    return <AlertCircle className="h-4 w-4 text-rose-600" />;
  }

  if (status === "running") {
    return <Loader2 className="h-4 w-4 animate-spin text-violet-600" />;
  }

  if (status === "skipped" || status === "ignored") {
    return <Check className="h-4 w-4 text-zinc-400" />;
  }

  return <Circle className="h-4 w-4 text-zinc-300" />;
}

function stepStatusLabel(status: TerminateStepResult["status"]) {
  if (status === "success") {
    return "Sucesso";
  }

  if (status === "error") {
    return "Erro";
  }

  if (status === "running") {
    return "Executando";
  }

  if (status === "skipped" || status === "ignored") {
    return "Ignorado";
  }

  return "Pendente";
}

interface TerminationChecklistProps {
  steps: TerminateStepResult[];
}

export function TerminationChecklist({ steps }: TerminationChecklistProps) {
  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li
          key={step.id}
          className="flex items-start gap-3 rounded-md border border-zinc-200 bg-white px-3 py-3"
        >
          <div className="mt-0.5">{stepIcon(step.status)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-zinc-950">{step.label}</p>
              <span className="text-xs text-zinc-500">{stepStatusLabel(step.status)}</span>
            </div>
            {step.message ? <p className="mt-1 text-sm text-zinc-600">{step.message}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
