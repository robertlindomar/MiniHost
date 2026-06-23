import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProject } from "@/lib/server/mappers";
import { validateProjectInput } from "@/lib/server/validation";
import type { ProjectFormInput } from "@/lib/types";

function normalizeProjectInput(body: Partial<ProjectFormInput>): ProjectFormInput {
  return {
    name: String(body.name ?? ""),
    slug: String(body.slug ?? ""),
    description: body.description ? String(body.description) : "",
    status: (body.status ?? "DRAFT") as ProjectFormInput["status"],
    mainDomain: body.mainDomain ? String(body.mainDomain) : ""
  };
}

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
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
      }
    });

    return ok({ projects: projects.map(toProject) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = normalizeProjectInput(await readBody<Partial<ProjectFormInput>>(request));
    const { data, errors } = validateProjectInput(body);

    if (errors.length > 0) {
      return fail(errors.join(" "));
    }

    const duplicate = await prisma.project.findUnique({ where: { slug: data.slug } });

    if (duplicate) {
      return fail("Já existe um projeto com esse slug.", 409);
    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data,
        include: {
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
        }
      });

      await writeAudit(tx, {
        action: "PROJECT_CREATE",
        entityType: "project",
        entityId: created.id,
        entityName: created.name,
        userId: user.id,
        description: `Projeto ${created.name} criado.`,
        newData: toProject(created)
      });

      return created;
    });

    return ok({ project: toProject(project) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
