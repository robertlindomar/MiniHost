import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toDnsRecord, toProject } from "@/lib/server/mappers";
import { validateProjectInput } from "@/lib/server/validation";
import type { ProjectFormInput } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const projectInclude = {
  _count: {
    select: {
      records: {
        where: { status: { not: "DELETED" } }
      },
      databases: {
        where: { status: { not: "ARCHIVED" } }
      }
    }
  }
} as const;

const recordInclude = {
  project: {
    select: {
      id: true,
      name: true
    }
  }
} as const;

function normalizeProjectInput(body: Partial<ProjectFormInput>): ProjectFormInput {
  return {
    name: String(body.name ?? ""),
    slug: String(body.slug ?? ""),
    description: body.description ? String(body.description) : "",
    status: (body.status ?? "DRAFT") as ProjectFormInput["status"],
    mainDomain: body.mainDomain ? String(body.mainDomain) : ""
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        ...projectInclude,
        records: {
          where: { status: { not: "DELETED" } },
          include: recordInclude,
          orderBy: { updatedAt: "desc" }
        }
      }
    });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const { records, ...projectData } = project;

    return ok({
      project: toProject(projectData),
      records: records.map(toDnsRecord)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = normalizeProjectInput(await readBody<Partial<ProjectFormInput>>(request));
    const { data, errors } = validateProjectInput(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const existing = await prisma.project.findUnique({
      where: { id },
      include: projectInclude
    });

    if (!existing) {
      return fail("Projeto não encontrado.", 404);
    }

    if (existing.status === "ARCHIVED") {
      return fail("Projetos arquivados não podem ser editados.");
    }

    const duplicate = await prisma.project.findFirst({
      where: {
        slug: data.slug,
        id: { not: id }
      }
    });

    if (duplicate) {
      return fail("Já existe um projeto com esse slug.", 409);
    }

    const project = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          status: data.status,
          mainDomain: data.mainDomain
        },
        include: projectInclude
      });

      await writeAudit(tx, {
        action: "PROJECT_UPDATE",
        entityType: "project",
        entityId: updated.id,
        entityName: updated.name,
        userId: user.id,
        description: `Projeto ${updated.name} atualizado.`,
        oldData: toProject(existing),
        newData: toProject(updated)
      });

      return updated;
    });

    return ok({ project: toProject(project) });
  } catch (error) {
    return handleRouteError(error);
  }
}
