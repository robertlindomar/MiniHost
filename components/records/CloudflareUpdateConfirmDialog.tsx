import { DnsTypeBadge } from "@/components/records/DnsTypeBadge";
import { ProxyBadge } from "@/components/records/ProxyBadge";
import { Modal } from "@/components/ui/Modal";
import { formatRecordValue, formatTtl } from "@/lib/format";
import type { DnsRecord, DnsRecordFormInput, Domain } from "@/lib/types";
import { isSensitiveRecord } from "@/lib/validation";

interface CloudflareUpdateConfirmDialogProps {
  record?: DnsRecord;
  input?: DnsRecordFormInput;
  domain?: Domain;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

type CompareRow = {
  label: string;
  before: string;
  after: string;
};

function formatInputValue(input: DnsRecordFormInput) {
  return input.type === "MX" && typeof input.priority === "number" ? `${input.priority} ${input.value}` : input.value;
}

function buildRows(record: DnsRecord, input: DnsRecordFormInput, domainName: string): CompareRow[] {
  return [
    { label: "Tipo", before: record.type, after: record.type },
    { label: "Nome/subdomínio", before: record.name, after: input.name },
    { label: "Domínio", before: domainName, after: domainName },
    { label: "Valor/conteúdo", before: formatRecordValue(record), after: formatInputValue(input) },
    { label: "TTL", before: formatTtl(record.ttl), after: formatTtl(input.ttl) },
    { label: "Proxy ativo", before: record.proxied ? "Sim" : "Não", after: input.proxied ? "Sim" : "Não" },
    { label: "Status", before: record.status === "inactive" ? "Inativo" : "Ativo", after: input.status === "inactive" ? "Inativo" : "Ativo" }
  ];
}

function ValueCell({ value, changed, tone }: { value: string; changed: boolean; tone: "before" | "after" }) {
  const changedClass = tone === "before" ? "border-rose-100 bg-rose-50 text-rose-800" : "border-emerald-100 bg-emerald-50 text-emerald-800";

  return (
    <span className={`block rounded-md border px-3 py-2 text-sm ${changed ? changedClass : "border-zinc-200 bg-white text-zinc-700"}`}>
      {value || "—"}
    </span>
  );
}

function buildTitleInfo(isSensitive: boolean) {
  const base = "Esta alteração será aplicada na Cloudflare e afetará o DNS público.";

  if (!isSensitive) {
    return base;
  }

  return `${base} Cuidado: este registro pode afetar site principal, e-mail ou validação de domínio.`;
}

export function CloudflareUpdateConfirmDialog({
  record,
  input,
  domain,
  isSubmitting = false,
  onCancel,
  onConfirm
}: CloudflareUpdateConfirmDialogProps) {
  const isOpen = Boolean(record && input);
  const domainName = domain?.name ?? "Domínio removido";
  const rows = record && input ? buildRows(record, input, domainName) : [];
  const isSensitive = record ? isSensitiveRecord(record) : false;
  const titleInfo = buildTitleInfo(isSensitive);

  return (
    <Modal
      isOpen={isOpen}
      title="Confirmar alteração na Cloudflare"
      titleInfo={titleInfo}
      onClose={onCancel}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Atualizando..." : "Confirmar alteração real na Cloudflare"}
          </button>
        </div>
      }
    >
      {record && input ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
            <DnsTypeBadge type={record.type} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-950">
                {record.name} em {domainName}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Proxy atual: <ProxyBadge proxied={record.proxied} />
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500">
                  <th className="px-2 py-1">Campo</th>
                  <th className="px-2 py-1">Antes</th>
                  <th className="px-2 py-1">Depois</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const changed = row.before !== row.after;

                  return (
                    <tr key={row.label}>
                      <td className="px-2 py-1 text-sm font-medium text-zinc-700">{row.label}</td>
                      <td className="px-2 py-1">
                        <ValueCell value={row.before} changed={changed} tone="before" />
                      </td>
                      <td className="px-2 py-1">
                        <ValueCell value={row.after} changed={changed} tone="after" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
