"use client";

import { ArrowRight, FileText, MoreVertical } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { DnsTypeBadge } from "@/components/dashboard/DnsTypeBadge";
import { formatRelativeTime } from "@/components/dashboard/time";
import { formatDateTime, formatRecordValue, formatTtl } from "@/lib/format";
import type { DnsRecord, Domain } from "@/lib/types";

interface RecentDnsTableProps {
  records: DnsRecord[];
  domains: Domain[];
  isLoading?: boolean;
}

function getDomainName(domains: Domain[], domainId: string) {
  return domains.find((domain) => domain.id === domainId)?.name ?? "Domínio removido";
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3, 4].map((item) => (
        <tr key={item} className="border-t border-zinc-100">
          <td className="px-4 py-4">
            <div className="h-6 w-12 rounded-md bg-zinc-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-16 rounded-md bg-zinc-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-56 rounded-md bg-zinc-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-36 rounded-md bg-zinc-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-14 rounded-md bg-zinc-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-4 w-24 rounded-md bg-zinc-100" />
          </td>
          <td className="px-4 py-4">
            <div className="h-8 w-8 rounded-md bg-zinc-100" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function RecentDnsTable({ records, domains, isLoading = false }: RecentDnsTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-soft">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Últimos registros criados/editados</h2>
            <p className="mt-1 text-sm text-zinc-500">Dados reais carregados do PostgreSQL.</p>
          </div>
        </div>
        <Link
          href="/records"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          Ver todos os registros
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {records.length === 0 && !isLoading ? (
        <EmptyState title="Nenhum registro encontrado" description="Crie seu primeiro registro DNS para acompanhar as alterações recentes aqui." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full border-collapse">
            <thead className="bg-zinc-50">
              <tr className="text-left text-xs font-semibold text-zinc-500">
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Domínio</th>
                <th className="px-4 py-3">TTL</th>
                <th className="px-4 py-3">Atualizado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <SkeletonRows />
              ) : (
                records.map((record) => {
                  const value = formatRecordValue(record);

                  return (
                    <tr key={record.id} className="text-sm text-zinc-700 transition hover:bg-zinc-50">
                      <td className="px-4 py-4">
                        <DnsTypeBadge type={record.type} />
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-zinc-950">{record.name}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span title={value} className="block max-w-xs truncate text-zinc-700">
                          {value}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-zinc-600">{getDomainName(domains, record.domainId)}</td>
                      <td className="px-4 py-4 text-zinc-700">{formatTtl(record.ttl)}</td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-zinc-900">{formatRelativeTime(record.updatedAt)}</div>
                        <div className="mt-1 text-xs text-zinc-500">{formatDateTime(record.updatedAt)}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/records?domain=${record.domainId}`}
                          aria-label={`Ver registros de ${getDomainName(domains, record.domainId)}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
