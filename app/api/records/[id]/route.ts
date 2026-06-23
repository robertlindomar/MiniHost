import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { validateLocalDnsRecordUniqueness, isRecordDeleted } from "@/lib/server/dns-records";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord } from "@/lib/server/mappers";
import { validateDnsRecordBody } from "@/lib/server/validation";
import { buildDeleteConfirmationText } from "@/lib/validation";
import type { DnsRecordFormInput, DnsRecordType } from "@/lib/types";

type DeleteLocalRecordBody = {
  confirmationText?: string;
  reason?: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeRecordInput(body: Partial<DnsRecordFormInput>): DnsRecordFormInput {
  return {
    domainId: String(body.domainId ?? ""),
    type: (body.type ?? "A") as DnsRecordType,
    name: String(body.name ?? ""),
    value: String(body.value ?? ""),
    ttl: body.ttl === "auto" ? "auto" : Number(body.ttl ?? 0),
    proxied: Boolean(body.proxied),
    status: body.status === "inactive" ? "inactive" : "active",
    comment: body.comment ? String(body.comment) : "",
    priority: body.priority === undefined || body.priority === null ? undefined : Number(body.priority)
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = normalizeRecordInput(await readBody<Partial<DnsRecordFormInput>>(request));
    const { data, errors } = validateDnsRecordBody(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const record = await prisma.$transaction(async (tx) => {
      const current = await tx.dnsRecord.findUnique({ where: { id } });

      if (!current) {
        throw new Error("Registro DNS não encontrado.");
      }

      if (isRecordDeleted(current.status)) {
        throw new Error("Este registro já está marcado como excluído.");
      }

      if (body.type !== current.type) {
        throw new Error("Não é permitido alterar o tipo do registro. Crie um novo registro se precisar trocar o tipo.");
      }

      const domain = await tx.domain.findUnique({ where: { id: data.domainId } });

      if (!domain) {
        throw new Error("Domínio não encontrado.");
      }

      await validateLocalDnsRecordUniqueness(tx, domain.id, domain.name, data, id);

      const updated = await tx.dnsRecord.update({
        where: { id },
        data
      });

      await writeAudit(tx, {
        action: "DNS_RECORD_UPDATE_LOCAL",
        entityType: "record",
        entityId: updated.id,
        entityName: `${updated.type} ${updated.name}`,
        userId: user.id,
        description: `Registro ${updated.type} ${updated.name} atualizado localmente em ${domain.name}.`,
        oldData: {
          domain: domain.name,
          type: current.type,
          name: current.name,
          content: current.content,
          proxied: current.proxied
        },
        newData: {
          domain: domain.name,
          type: updated.type,
          name: updated.name,
          content: updated.content,
          proxied: updated.proxied
        }
      });

      return updated;
    });

    return ok({
      message: "Registro atualizado apenas localmente.",
      record: toDnsRecord(record)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = await readBody<DeleteLocalRecordBody>(request);
    const reason = body.reason?.trim() || undefined;

    const record = await prisma.$transaction(async (tx) => {
      const current = await tx.dnsRecord.findUnique({
        where: { id },
        include: { domain: true }
      });

      if (!current) {
        throw new Error("Registro DNS não encontrado.");
      }

      if (isRecordDeleted(current.status)) {
        throw new Error("Este registro já está marcado como excluído.");
      }

      if (current.cloudflareRecordId) {
        throw new Error("Este registro está vinculado à Cloudflare. Use a exclusão real.");
      }

      const expectedConfirmation = buildDeleteConfirmationText(current.name, current.domain.name);
      const confirmationText = body.confirmationText?.trim() ?? "";

      if (confirmationText.trim().toLowerCase() !== expectedConfirmation) {
        throw new Error("Texto de confirmação inválido.");
      }

      const deletedAt = new Date();
      const updated = await tx.dnsRecord.update({
        where: { id },
        data: {
          status: "DELETED",
          deletedAt,
          deletedBy: user.id,
          deletionReason: reason ?? null
        }
      });

      await writeAudit(tx, {
        action: "DNS_RECORD_DELETE_LOCAL",
        entityType: "record",
        entityId: current.id,
        entityName: `${current.type} ${current.name}`,
        userId: user.id,
        description: `Registro ${current.type} ${current.name} marcado como excluído em ${current.domain.name}.`,
        oldData: {
          domain: current.domain.name,
          type: current.type,
          name: current.name,
          content: current.content,
          proxied: current.proxied,
          status: current.status,
          reason: reason ?? null
        },
        newData: {
          status: "DELETED",
          deletedAt: deletedAt.toISOString(),
          deletedBy: user.id,
          reason: reason ?? null
        }
      });

      return updated;
    });

    return ok({
      message: "Registro marcado como excluído localmente.",
      record: toDnsRecord(record)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
