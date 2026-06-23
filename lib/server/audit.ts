import type { Prisma, PrismaClient } from "@prisma/client";

type AuditClient = PrismaClient | Prisma.TransactionClient;

interface AuditInput {
  action: string;
  entityType: "domain" | "record" | "settings" | "project";
  entityId?: string | null;
  entityName?: string | null;
  userId?: string | null;
  description: string;
  oldData?: unknown;
  newData?: unknown;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function writeAudit(prisma: AuditClient, input: AuditInput) {
  return prisma.auditLog.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      entityName: input.entityName ?? null,
      userId: input.userId ?? null,
      description: input.description,
      oldData: toJsonValue(input.oldData),
      newData: toJsonValue(input.newData)
    }
  });
}
