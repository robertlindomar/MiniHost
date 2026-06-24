import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import {
  ProjectTerminatorError,
  terminateProject
} from "@/lib/server/project-terminator";
import type { ProjectTerminateInput } from "@/lib/terminate";

type TerminateBody = ProjectTerminateInput;

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<Partial<TerminateBody>>(request);

    const projectId = String(body.projectId ?? "").trim();
    const confirmationText = String(body.confirmationText ?? "").trim();
    const understandRisk = Boolean(body.understandRisk);
    const retryPendingOnly = Boolean(body.retryPendingOnly);
    const options = body.options;

    if (!projectId) {
      return fail("Informe o projeto a encerrar.");
    }

    if (!options) {
      return fail("Informe as opções de encerramento.");
    }

    const result = await terminateProject({
      projectId,
      confirmationText,
      understandRisk,
      retryPendingOnly,
      options: {
        archiveProject: options.archiveProject !== false,
        deleteDnsRecords: options.deleteDnsRecords !== false,
        deleteCoolifyApplications: options.deleteCoolifyApplications !== false,
        deleteCoolifyProject: options.deleteCoolifyProject !== false,
        destroyDatabases: options.destroyDatabases === true,
        confirmExternalCoolifyRemoval: options.confirmExternalCoolifyRemoval === true
      },
      userId: user.id
    });

    return ok(result);
  } catch (error) {
    if (error instanceof ProjectTerminatorError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
