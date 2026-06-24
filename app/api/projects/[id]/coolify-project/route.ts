import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import {
  backfillProjectCoolifyLink,
  detectProjectCoolifyInconsistencies,
  getProjectCoolifyLink
} from "@/lib/server/project-coolify-project";
import { toProjectCoolifyLink } from "@/lib/server/mappers";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const [link, inconsistencies] = await Promise.all([
      getProjectCoolifyLink(id),
      detectProjectCoolifyInconsistencies(id)
    ]);

    return ok({
      coolifyLink: link ? toProjectCoolifyLink(link) : null,
      inconsistencies
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const result = await backfillProjectCoolifyLink(id, user.id);

    if (result.status === "inconsistent") {
      return fail(result.message, 409);
    }

    return ok(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
