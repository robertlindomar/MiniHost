import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  buildConnectionUrl,
  decryptDatabasePassword,
  encryptDatabasePassword,
  sanitizeProjectDatabaseForAudit
} from "@/lib/server/project-database";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectDatabase } from "@/lib/server/mappers";
import { validateProjectDatabaseInput, validateProjectDatabaseUpdateInput } from "@/lib/server/validation";
import type { ProjectDatabaseFormInput, ProjectDatabaseStatus } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string; databaseId: string }>;
};

function normalizeUpdateInput(body: Partial<ProjectDatabaseFormInput>) {
  return {
    name: body.name !== undefined ? String(body.name) : undefined,
    databaseName: body.databaseName !== undefined ? String(body.databaseName) : undefined,
    databaseUser: body.databaseUser !== undefined ? String(body.databaseUser) : undefined,
    host: body.host !== undefined ? String(body.host) : undefined,
    port: body.port !== undefined ? Number(body.port) : undefined,
    status: body.status as ProjectDatabaseStatus | undefined,
    notes: body.notes !== undefined ? String(body.notes) : undefined
  };
}

async function getDatabase(projectId: string, databaseId: string) {
  return prisma.projectDatabase.findFirst({
    where: { id: databaseId, projectId }
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireCurrentUser(request);
    const { id, databaseId } = await context.params;
    const database = await getDatabase(id, databaseId);

    if (!database) {
      return fail("Banco não encontrado.", 404);
    }

    return ok({ database: toProjectDatabase(database) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, databaseId } = await context.params;
    const existing = await getDatabase(id, databaseId);

    if (!existing) {
      return fail("Banco não encontrado.", 404);
    }

    if (existing.status === "ARCHIVED") {
      return fail("Bancos arquivados não podem ser editados.");
    }

    const body = normalizeUpdateInput(await readBody<Partial<ProjectDatabaseFormInput>>(request));
    const mergedInput = {
      name: body.name ?? existing.name,
      databaseName: body.databaseName ?? existing.databaseName,
      databaseUser: body.databaseUser ?? existing.databaseUser,
      host: body.host ?? existing.host,
      port: body.port ?? existing.port,
      status: body.status ?? existing.status,
      notes: body.notes ?? existing.notes ?? ""
    };

    const { data, errors } = validateProjectDatabaseUpdateInput(mergedInput);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    if (data.databaseName !== existing.databaseName) {
      const duplicateDatabase = await prisma.projectDatabase.findFirst({
        where: {
          host: data.host,
          databaseName: data.databaseName,
          status: { not: "ARCHIVED" },
          id: { not: existing.id }
        }
      });

      if (duplicateDatabase) {
        return fail("Já existe um banco com esse database name neste host.", 409);
      }
    }

    if (data.databaseUser !== existing.databaseUser) {
      const duplicateUser = await prisma.projectDatabase.findFirst({
        where: {
          host: data.host,
          databaseUser: data.databaseUser,
          status: { not: "ARCHIVED" },
          id: { not: existing.id }
        }
      });

      if (duplicateUser) {
        return fail("Já existe um banco com esse usuário neste host.", 409);
      }
    }

    const password = decryptDatabasePassword(existing.databasePasswordEncrypted);
    const connectionUrlEncrypted = encryptDatabasePassword(
      buildConnectionUrl(data.databaseUser, password, data.host, data.port, data.databaseName)
    );

    const database = await prisma.$transaction(async (tx) => {
      const updated = await tx.projectDatabase.update({
        where: { id: existing.id },
        data: {
          name: data.name,
          databaseName: data.databaseName,
          databaseUser: data.databaseUser,
          host: data.host,
          port: data.port,
          status: data.status,
          notes: data.notes,
          connectionUrlEncrypted
        }
      });

      await writeAudit(tx, {
        action: "PROJECT_DATABASE_UPDATE",
        entityType: "project_database",
        entityId: updated.id,
        entityName: updated.name,
        userId: user.id,
        description: `Banco ${updated.name} atualizado.`,
        oldData: sanitizeProjectDatabaseForAudit(toProjectDatabase(existing)),
        newData: sanitizeProjectDatabaseForAudit(toProjectDatabase(updated))
      });

      return updated;
    });

    return ok({ database: toProjectDatabase(database) });
  } catch (error) {
    return handleRouteError(error);
  }
}
