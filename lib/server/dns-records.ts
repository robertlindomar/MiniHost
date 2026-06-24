import type { Prisma } from "@prisma/client";

type RecordLike = {
  id?: string;
  type: string;
  name: string;
};

export type ValidatedDnsRecordData = {
  domainId: string;
  projectId?: string | null;
  type: string;
  name: string;
  content: string;
  ttl: number | null;
  proxied: boolean;
  status: string;
  comment: string | null;
  priority: number | null;
};

export function normalizeDnsRecordName(name: string) {
  const normalized = name.trim().toLowerCase();
  return normalized === "" ? "@" : normalized;
}

export function toCloudflareRecordName(name: string, domainName: string) {
  const normalized = normalizeDnsRecordName(name);
  const normalizedDomain = domainName.toLowerCase();

  if (normalized === "@" || normalized === normalizedDomain) {
    return domainName;
  }

  if (normalized.endsWith(`.${normalizedDomain}`)) {
    return normalized;
  }

  return `${normalized}.${domainName}`;
}

export function toComparableRecordName(name: string, domainName: string) {
  const normalized = normalizeDnsRecordName(name);
  const normalizedDomain = domainName.toLowerCase();

  if (normalized === normalizedDomain) {
    return "@";
  }

  if (normalized.endsWith(`.${normalizedDomain}`)) {
    return normalized.slice(0, normalized.length - normalizedDomain.length - 1) || "@";
  }

  return normalized;
}

export function buildRecordFqdn(recordName: string, domainName: string) {
  const normalizedName = recordName.trim().toLowerCase();
  const normalizedDomain = domainName.trim().toLowerCase();

  if (!normalizedName || normalizedName === "@") {
    return normalizedDomain;
  }

  if (normalizedName === normalizedDomain || normalizedName.endsWith(`.${normalizedDomain}`)) {
    return normalizedName;
  }

  return `${normalizedName}.${normalizedDomain}`;
}

function isAddressRecord(type: string) {
  return type === "A" || type === "AAAA";
}

function isCnameAddressConflict(typeA: string, typeB: string) {
  return (typeA === "CNAME" && isAddressRecord(typeB)) || (isAddressRecord(typeA) && typeB === "CNAME");
}

export function findDnsRecordConflict(records: RecordLike[], input: Pick<ValidatedDnsRecordData, "type" | "name">, domainName: string, excludeId?: string) {
  const inputName = toComparableRecordName(input.name, domainName);

  for (const record of records) {
    if (record.id && record.id === excludeId) {
      continue;
    }

    const recordName = toComparableRecordName(record.name, domainName);

    if (recordName !== inputName) {
      continue;
    }

    if (record.type === input.type) {
      return "Já existe um registro com esse nome e tipo.";
    }

    if (isCnameAddressConflict(input.type, record.type)) {
      return "CNAME não pode coexistir com registros A/AAAA no mesmo nome.";
    }
  }

  return null;
}

export async function validateLocalDnsRecordUniqueness(
  tx: Prisma.TransactionClient,
  domainId: string,
  domainName: string,
  input: Pick<ValidatedDnsRecordData, "type" | "name">,
  excludeId?: string
) {
  const records = await tx.dnsRecord.findMany({
    where: {
      domainId,
      status: { not: "DELETED" }
    },
    select: {
      id: true,
      type: true,
      name: true
    }
  });
  const conflict = findDnsRecordConflict(records, input, domainName, excludeId);

  if (conflict) {
    throw new Error(conflict);
  }
}

export function isRecordDeleted(status: string) {
  return status === "DELETED";
}
