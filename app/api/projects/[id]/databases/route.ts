import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import {
  buildConnectionUrl,
  encryptDatabasePassword,
  generateDatabasePassword,
  sanitizeProjectDatabaseForAudit
} from "@/lib/server/project-database";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { defaultSettings, toProjectDatabase, toSettings } from "@/lib/server/mappers";
import { validateProjectDatabaseInput } from "@/lib/server/validation";
import type { ProjectDatabaseFormInput } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function normalizeDatabaseInput(body: Partial<ProjectDatabaseFormInput>): ProjectDatabaseFormInput {
  return {
    name: String(body.name ?? ""),
    databaseName: String(body.databaseName ?? ""),
    databaseUser: String(body.databaseUser ?? ""),
    password: body.password ? String(body.password) : "",
    generatePassword: Boolean(body.generatePassword),
    host: String(body.host ?? ""),
    port: Number(body.port ?? 5432),
    status: (body.status ?? "PLANNED") as ProjectDatabaseFormInput["status"],
    notes: body.notes ? String(body.notes) : ""
  };
}

async function assertProjectExists(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });

  if (!project) {
    return null;
  }

  if (project.status === "ARCHIVED") {
    throw new Error("Não é possível gerenciar bancos de um projeto arquivado.");
  }

  return project;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const databases = await prisma.projectDatabase.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" }
    });

    return ok({ databases: databases.map(toProjectDatabase) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const project = await assertProjectExists(id);

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const body = normalizeDatabaseInput(await readBody<Partial<ProjectDatabaseFormInput>>(request));
    const { data, errors } = validateProjectDatabaseInput(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const duplicateDatabase = await prisma.projectDatabase.findFirst({
      where: {
        host: data.host,
        databaseName: data.databaseName,
        status: { notIn: ["ARCHIVED", "DESTROYED", "PARTIALLY_DESTROYED"] }
      }
    });

    if (duplicateDatabase) {
      return fail("Já existe um banco com esse database name neste host.", 409);
    }

    const duplicateUser = await prisma.projectDatabase.findFirst({
      where: {
        host: data.host,
        databaseUser: data.databaseUser,
        status: { notIn: ["ARCHIVED", "DESTROYED", "PARTIALLY_DESTROYED"] }
      }
    });

    if (duplicateUser) {
      return fail("Já existe um banco com esse usuário neste host.", 409);
    }

    const plainPassword = data.generatePassword ? generateDatabasePassword() : (data.password as string);
    const passwordEncrypted = encryptDatabasePassword(plainPassword);
    const connectionUrlEncrypted = encryptDatabasePassword(
      buildConnectionUrl(data.databaseUser, plainPassword, data.host, data.port, data.databaseName)
    );

    const database = await prisma.$transaction(async (tx) => {
      const created = await tx.projectDatabase.create({
        data: {
          projectId: id,
          name: data.name,
          databaseName: data.databaseName,
          databaseUser: data.databaseUser,
          databasePasswordEncrypted: passwordEncrypted,
          host: data.host,
          port: data.port,
          status: data.status,
          connectionUrlEncrypted,
          notes: data.notes
        }
      });

      await writeAudit(tx, {
        action: "PROJECT_DATABASE_CREATE",
        entityType: "project_database",
        entityId: created.id,
        entityName: created.name,
        userId: user.id,
        description: `Banco ${created.name} planejado para o projeto ${project.name}.`,
        newData: sanitizeProjectDatabaseForAudit(toProjectDatabase(created))
      });

      return created;
    });

    return ok(
      {
        database: toProjectDatabase(database),
        generatedPassword: plainPassword
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("projeto arquivado")) {
      return fail(error.message);
    }

    return handleRouteError(error);
  }
}
