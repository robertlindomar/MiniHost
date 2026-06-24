import { publishStaticApplication, StaticPublishError } from "@/lib/server/static-publish-orchestrator";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import type { StaticPublishInput } from "@/lib/publish";

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<Partial<StaticPublishInput>>(request);
    const result = await publishStaticApplication(body as StaticPublishInput, user.id);

    if (!result.success) {
      return ok(result, { status: 422 });
    }

    return ok(result, { status: 201 });
  } catch (error) {
    if (error instanceof StaticPublishError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
