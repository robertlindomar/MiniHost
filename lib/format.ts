import type { DnsRecord, TtlValue } from "@/lib/types";

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short"
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short"
});

export function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateTimeFormatter.format(date);
}

export function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateFormatter.format(date);
}

export function formatTtl(value: TtlValue) {
  return value === "auto" ? "Automático" : `${value}s`;
}

export function formatRecordValue(record: DnsRecord) {
  if (record.type === "MX" && typeof record.priority === "number") {
    return `${record.priority} ${record.value}`;
  }

  return record.value;
}
