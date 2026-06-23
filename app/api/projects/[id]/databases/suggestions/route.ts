import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { buildSuggestedDatabaseFields } from "@/lib/server/project-database";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import { defaultSettings, toSettings } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return fail("Projeto não encontrado.", 404);
    }

    const rows = await prisma.appSetting.findMany();
    const settings = rows.length > 0 ? toSettings(rows) : defaultSettings;
    const suggestions = buildSuggestedDatabaseFields(project.slug, settings);

    return ok({ suggestions });
  } catch (error) {
    return handleRouteError(error);
  }
}
