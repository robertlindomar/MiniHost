import type { DnsRecordFormInput, DomainFormInput, MiniHostSettings } from "@/lib/types";
import { isMaskedSecretValue, validateSettingsInput } from "@/lib/settings";
import { isDomainLike, isPlausibleZoneId, validateRecordInput } from "@/lib/validation";

export function validateDomainInput(input: DomainFormInput) {
  const errors: string[] = [];
  const name = input.name?.trim().toLowerCase();
  const provider = input.provider?.trim();

  if (!name) {
    errors.push("Informe o nome do domínio.");
  }

  if (name && /\s/.test(name)) {
    errors.push("Nome do domínio não pode ter espaço.");
  }

  if (name && /^https?:\/\//i.test(name)) {
    errors.push("Informe apenas o domínio, sem http:// ou https://.");
  }

  if (name && !isDomainLike(name)) {
    errors.push("Informe um domínio válido, como exemplo.com.");
  }

  if (!provider) {
    errors.push("Informe o provedor.");
  }

  if (input.status !== "active" && input.status !== "inactive") {
    errors.push("Status inválido.");
  }

  if (input.zoneId && !isPlausibleZoneId(input.zoneId)) {
    errors.push("Zone ID deve ter um formato plausível.");
  }

  return {
    errors,
    data: {
      name,
      provider,
      zoneId: input.zoneId?.trim() || null,
      status: input.status === "inactive" ? "inactive" : "active"
    }
  };
}

export function validateSettingsBody(input: Partial<MiniHostSettings>) {
  const { errors, data } = validateSettingsInput(input);
  const errorList = Object.values(errors);

  return {
    errors: errorList,
    fieldErrors: errors,
    data: {
      ...data,
      cloudflareApiToken: isMaskedSecretValue(data.cloudflareApiToken) ? "" : data.cloudflareApiToken.trim()
    }
  };
}

export function validateDnsRecordBody(input: DnsRecordFormInput) {
  const errors = validateRecordInput(input);

  if (!["A", "AAAA", "CNAME", "TXT", "MX"].includes(input.type)) {
    errors.push("Tipo de registro inválido.");
  }

  const proxied = input.type === "TXT" || input.type === "MX" ? false : Boolean(input.proxied);

  return {
    errors,
    data: {
      domainId: input.domainId,
      type: input.type,
      name: input.name.trim(),
      content: input.value.trim(),
      ttl: input.ttl === "auto" || input.ttl === 1 ? null : Number(input.ttl),
      proxied,
      status: input.status === "inactive" ? "inactive" : "active",
      comment: input.comment?.trim() || null,
      priority: input.type === "MX" ? Number(input.priority) : null
    }
  };
}
