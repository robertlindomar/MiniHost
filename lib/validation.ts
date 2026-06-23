import type { DnsRecord, DnsRecordFormInput } from "@/lib/types";

export function isValidIPv4(value: string) {
  const parts = value.trim().split(".");

  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }

    const number = Number(part);
    return number >= 0 && number <= 255 && String(number) === part;
  });
}

export function isValidIPv6(value: string) {
  const normalized = value.trim();

  if (!normalized || normalized.includes(" ")) {
    return false;
  }

  if ((normalized.match(/::/g) ?? []).length > 1) {
    return false;
  }

  const isHexSegment = (part: string) => /^[0-9a-fA-F]{1,4}$/.test(part);

  if (normalized.includes("::")) {
    const [left, right] = normalized.split("::");
    const leftParts = left ? left.split(":") : [];
    const rightParts = right ? right.split(":") : [];
    const parts = [...leftParts, ...rightParts];

    return parts.length <= 7 && parts.every(isHexSegment);
  }

  const parts = normalized.split(":");

  if (parts.length !== 8) {
    return false;
  }

  return parts.every(isHexSegment);
}

export function isDomainLike(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized.includes(" ") || normalized.includes("://")) {
    return false;
  }

  return /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized);
}

export function validateRecordInput(input: DnsRecordFormInput) {
  const errors: string[] = [];
  const name = input.name.trim();
  const value = input.value.trim();

  if (!input.domainId) {
    errors.push("Selecione um domínio.");
  }

  if (!name) {
    errors.push("Informe o nome ou subdomínio.");
  }

  if (/\s/.test(name)) {
    errors.push("Nome/subdomínio não pode ter espaço.");
  }

  if (!value) {
    errors.push("Informe o valor/conteúdo.");
  }

  if (input.type === "A" && !isValidIPv4(value)) {
    errors.push("Registro A deve parecer um IPv4 válido.");
  }

  if (input.type === "AAAA" && !isValidIPv6(value)) {
    errors.push("Registro AAAA deve parecer um IPv6 válido.");
  }

  if (input.type === "CNAME" && !isDomainLike(value)) {
    errors.push("Registro CNAME deve parecer um domínio válido.");
  }

  if ((input.type === "TXT" || input.type === "MX") && input.proxied) {
    errors.push("Registros TXT e MX não podem usar proxy ativo.");
  }

  if (input.type === "MX") {
    if (
      typeof input.priority !== "number" ||
      !Number.isFinite(input.priority) ||
      input.priority < 0 ||
      input.priority > 65535
    ) {
      errors.push("Registro MX deve ter prioridade entre 0 e 65535.");
    }

    if (!isDomainLike(value)) {
      errors.push("Registro MX deve ter um servidor válido.");
    }
  }

  if (typeof input.ttl === "number" && input.ttl !== 1 && (!Number.isFinite(input.ttl) || input.ttl < 60)) {
    errors.push("TTL manual deve ser de pelo menos 60 segundos.");
  }

  return errors;
}

export function isSensitiveRecord(record: Pick<DnsRecord, "name" | "type"> & { value?: string }) {
  const normalizedName = record.name.trim().toLowerCase();
  const sensitiveNames = ["", "@", "www", "mail", "_dmarc", "_domainkey"];
  const normalizedValue = (record.value ?? "").trim().toLowerCase();

  if (sensitiveNames.includes(normalizedName)) {
    return true;
  }

  if (record.type === "MX" || record.type === "TXT") {
    return true;
  }

  if (normalizedName.includes("spf") || normalizedName.includes("dkim") || normalizedName.includes("dmarc")) {
    return true;
  }

  if (normalizedValue.includes("v=spf1") || normalizedValue.includes("v=dmarc1") || normalizedValue.includes("dkim")) {
    return true;
  }

  return false;
}

export function buildDeleteConfirmationText(recordName: string, domainName: string) {
  const normalizedName = recordName.trim().toLowerCase();
  const normalizedDomain = domainName.trim().toLowerCase();

  if (normalizedName === "@" || normalizedName === "" || normalizedName === normalizedDomain) {
    return normalizedDomain;
  }

  if (normalizedName.endsWith(`.${normalizedDomain}`)) {
    return normalizedName;
  }

  return `${normalizedName}.${normalizedDomain}`;
}
