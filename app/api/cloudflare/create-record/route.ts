import { CloudflareApiError } from "@/lib/cloudflare";
import { prisma } from "@/lib/prisma";
import { CloudflareDnsRecordError, createCloudflareDnsRecord } from "@/lib/server/cloudflare-dns-record";
import { CloudflareTokenError } from "@/lib/server/cloudflare-credential";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { validateDnsRecordBody } from "@/lib/server/validation";
import type { DnsRecordFormInput, DnsRecordType } from "@/lib/types";

type CreateCloudflareRecordBody = Partial<DnsRecordFormInput> & {
  content?: string;
};

function normalizeRecordInput(body: CreateCloudflareRecordBody): DnsRecordFormInput {
  return {
    domainId: String(body.domainId ?? ""),
    type: (body.type ?? "A") as DnsRecordType,
    name: String(body.name ?? ""),
    value: String(body.value ?? body.content ?? ""),
    ttl: body.ttl === "auto" ? "auto" : Number(body.ttl ?? 1),
    proxied: Boolean(body.proxied),
    status: body.status === "inactive" ? "inactive" : "active",
    comment: body.comment ? String(body.comment) : "",
    priority: body.priority === undefined || body.priority === null ? undefined : Number(body.priority),
    templateName: body.templateName ? String(body.templateName) : undefined,
    projectId: body.projectId ? String(body.projectId) : undefined,
    fromProjectTemplate: Boolean(body.fromProjectTemplate)
  };
}

export async function POST(request: Request) {
  let userId: string | undefined;
  let domainId: string | undefined;
  let domainName: string | undefined;
  let requestedRecord: DnsRecordFormInput | undefined;

  try {
    const user = await requireCurrentUser(request);
    userId = user.id;
    const body = normalizeRecordInput(await readBody<CreateCloudflareRecordBody>(request));
    requestedRecord = body;
    domainId = body.domainId;

    const { data, errors } = validateDnsRecordBody(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const action = body.fromProjectTemplate
      ? "DNS_RECORD_CREATE_FROM_PROJECT_TEMPLATE"
      : body.templateName
        ? "DNS_RECORD_CREATE_FROM_TEMPLATE_CLOUDFLARE"
        : "DNS_RECORD_CREATE_CLOUDFLARE";

    const description = body.fromProjectTemplate
      ? `Registro ${data.type} ${data.name} criado na Cloudflare pelo template ${body.templateName} no projeto.`
      : body.templateName
        ? `Registro ${data.type} ${data.name} criado na Cloudflare pelo template ${body.templateName}.`
        : `Registro ${data.type} ${data.name} criado na Cloudflare.`;

    const result = await createCloudflareDnsRecord({
      userId,
      domainId: data.domainId,
      data,
      auditAction: action,
      auditDescription: description
    });

    return ok(
      {
        message: "Registro criado na Cloudflare com sucesso.",
        record: result.record
      },
      { status: 201 }
    );
  } catch (error) {
    const description =
      error instanceof CloudflareApiError
        ? `Não foi possível criar o registro na Cloudflare. ${error.message}`
        : error instanceof Error
          ? error.message
          : "Não foi possível criar o registro na Cloudflare.";

    if (domainId) {
      await prisma.auditLog
        .create({
          data: {
            action: "DNS_RECORD_CREATE_CLOUDFLARE_FAILED",
            entityType: "record",
            entityId: null,
            entityName: requestedRecord ? `${requestedRecord.type} ${requestedRecord.name || "@"}` : null,
            userId,
            description,
            newData: {
              domainId,
              domainName,
              templateName: requestedRecord?.templateName,
              type: requestedRecord?.type,
              name: requestedRecord?.name,
              content: requestedRecord?.value
            }
          }
        })
        .catch(() => undefined);
    }

    if (error instanceof CloudflareDnsRecordError) {
      return fail(error.message, 400);
    }

    if (error instanceof CloudflareTokenError) {
      return fail(error.message, 400);
    }

    if (error instanceof CloudflareApiError) {
      return fail("Não foi possível criar o registro na Cloudflare. Verifique token, Zone ID e permissões.", error.status ?? 400);
    }

    return handleRouteError(error);
  }
}
