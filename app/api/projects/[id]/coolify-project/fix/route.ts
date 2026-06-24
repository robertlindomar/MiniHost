import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import {
  fixProjectCoolifyInconsistency,
  ProjectCoolifyProjectError
} from "@/lib/server/project-coolify-project";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type FixBody = {
  strategy?: "from_project_link" | "from_first_app" | "clear_broken_link";
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = await readBody<FixBody>(request);
    const strategy = body.strategy;

    if (
      strategy !== "from_project_link" &&
      strategy !== "from_first_app" &&
      strategy !== "clear_broken_link"
    ) {
      return fail("Estratégia de correção inválida.");
    }

    const result = await fixProjectCoolifyInconsistency(id, user.id, strategy);

    return ok(result);
  } catch (error) {
    if (error instanceof ProjectCoolifyProjectError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
