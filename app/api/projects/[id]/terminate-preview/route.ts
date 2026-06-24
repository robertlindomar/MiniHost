import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok } from "@/lib/server/http";
import {
  getProjectTerminatePreview,
  ProjectTerminatorError
} from "@/lib/server/project-terminator";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;
    const preview = await getProjectTerminatePreview(id);

    return ok(preview);
  } catch (error) {
    if (error instanceof ProjectTerminatorError) {
      return fail(error.message, 404);
    }

    return handleRouteError(error);
  }
}
