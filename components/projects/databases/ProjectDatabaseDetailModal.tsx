"use client";

import { Copy, Database, RefreshCw, ShieldCheck, TerminalSquare } from "lucide-react";
import { useState } from "react";
import { ProjectDatabaseStatusBadge } from "@/components/projects/databases/ProjectDatabaseStatusBadge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { formatDateTime } from "@/lib/format";
import { canManageDatabasePermissions, canProvisionDatabase } from "@/lib/provision";
import { MASKED_SECRET_VALUE } from "@/lib/settings";
import type { ProjectDatabase, ProjectDatabasePermissionVerification } from "@/lib/types";

interface ProjectDatabaseDetailModalProps {
  database?: ProjectDatabase;
  isOpen: boolean;
  isSubmitting?: boolean;
  hasAdminCredential?: boolean;
  envContent?: string;
  sqlContent?: string;
  generatedPassword?: string;
  warning?: string;
  permissionVerification?: ProjectDatabasePermissionVerification;
  onClose: () => void;
  onGenerateEnv: () => void;
  onGenerateSql: () => void;
  onRotatePassword: () => void;
  onProvision?: () => void;
  onVerifyPermissions?: () => void;
  onFixPermissions?: () => void;
}

export function ProjectDatabaseDetailModal({
  database,
  isOpen,
  isSubmitting = false,
  envContent,
  sqlContent,
  generatedPassword,
  warning,
  hasAdminCredential = false,
  onClose,
  onGenerateEnv,
  onGenerateSql,
  onRotatePassword,
  onProvision,
  onVerifyPermissions,
  onFixPermissions,
  permissionVerification
}: ProjectDatabaseDetailModalProps) {
  const [passwordCopied, setPasswordCopied] = useState(false);

  async function copyPassword() {
    if (!generatedPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      window.setTimeout(() => setPasswordCopied(false), 2000);
    } catch {
      setPasswordCopied(false);
    }
  }

  if (!database) {
    return null;
  }

  const showProvisionButton = canProvisionDatabase(database.status, Boolean(hasAdminCredential));
  const showRetryButton = database.status === "FAILED" && showProvisionButton;
  const showPermissionActions = canManageDatabasePermissions(database.status, Boolean(hasAdminCredential));

  return (
    <Modal isOpen={isOpen} title={database.name} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <ProjectDatabaseStatusBadge status={database.status} />
          <span className="text-sm text-zinc-500">Criado em {formatDateTime(database.createdAt)}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Database</p>
            <p className="mt-1 font-mono text-sm text-zinc-900">{database.databaseName}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Usuário</p>
            <p className="mt-1 font-mono text-sm text-zinc-900">{database.databaseUser}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Host</p>
            <p className="mt-1 text-sm text-zinc-900">{database.host}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">Porta</p>
            <p className="mt-1 text-sm text-zinc-900">{database.port}</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">Senha</p>
          <p className="mt-1 font-mono text-sm text-zinc-700">{MASKED_SECRET_VALUE}</p>
        </div>

        {generatedPassword ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Senha gerada — copie agora</p>
            <p className="mt-1 text-xs text-amber-800">Esta senha não será exibida novamente após fechar este painel.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <code className="rounded-md bg-white px-3 py-2 font-mono text-sm text-zinc-900">{generatedPassword}</code>
              <button
                type="button"
                onClick={() => void copyPassword()}
                className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                <Copy className="h-3.5 w-3.5" />
                {passwordCopied ? "Copiado" : "Copiar senha"}
              </button>
            </div>
          </div>
        ) : null}

        {database.lastProvisionError ? (
          <Notice type="error" message={`Último erro de provisionamento: ${database.lastProvisionError}`} />
        ) : null}

        {database.provisionedAt ? (
          <p className="text-sm text-zinc-500">Provisionado em {formatDateTime(database.provisionedAt)}</p>
        ) : null}

        {permissionVerification ? (
          <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900">Verificação de permissões</p>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  permissionVerification.ok
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {permissionVerification.ok ? "OK" : "Atenção"}
              </span>
            </div>
            <p className="text-sm text-zinc-600">
              Bancos com CONNECT para <code className="font-mono">{permissionVerification.projectUser}</code>:{" "}
              {permissionVerification.connectableDatabases.length > 0
                ? permissionVerification.connectableDatabases.join(", ")
                : "nenhum"}
            </p>
            {permissionVerification.unexpectedDatabases.length > 0 ? (
              <Notice
                type="error"
                message={`Acesso inesperado em: ${permissionVerification.unexpectedDatabases.join(", ")}`}
              />
            ) : null}
            {permissionVerification.publicConnectWarnings.map((warningMessage) => (
              <Notice key={warningMessage} type="error" message={warningMessage} />
            ))}
          </div>
        ) : null}

        {database.notes ? (
          <div>
            <p className="text-sm font-medium text-zinc-700">Observações</p>
            <p className="mt-1 text-sm leading-6 text-zinc-600">{database.notes}</p>
          </div>
        ) : null}

        {database.status !== "ARCHIVED" ? (
          <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4">
            {showProvisionButton ? (
              <button
                type="button"
                onClick={() => onProvision?.()}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Database className="h-3.5 w-3.5" />
                {showRetryButton ? "Tentar novamente" : "Criar banco real"}
              </button>
            ) : null}
            {showPermissionActions ? (
              <>
                <button
                  type="button"
                  onClick={() => onVerifyPermissions?.()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verificar permissões
                </button>
                <button
                  type="button"
                  onClick={() => onFixPermissions?.()}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Corrigir permissões
                </button>
              </>
            ) : null}
            <button
              type="button"
              onClick={onGenerateEnv}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <TerminalSquare className="h-3.5 w-3.5" />
              Gerar .env
            </button>
            <button
              type="button"
              onClick={onGenerateSql}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <TerminalSquare className="h-3.5 w-3.5" />
              Gerar SQL manual
            </button>
            <button
              type="button"
              onClick={onRotatePassword}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Gerar nova senha
            </button>
          </div>
        ) : null}

        {warning ? <Notice type="info" message={warning} /> : null}

        {envContent ? <CodeBlock content={envContent} label=".env gerado" /> : null}
        {sqlContent ? <CodeBlock content={sqlContent} label="SQL manual" /> : null}
      </div>
    </Modal>
  );
}
