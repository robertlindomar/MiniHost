import { buildApplyEnvsConfirmationText } from "@/lib/provision";
import {
  applyEnvsToCoolifyApplication,
  CoolifyPostProvisionError
} from "@/lib/server/coolify-application-post-provision";
import { hasCoolifyCredential, CoolifyCredentialError } from "@/lib/server/coolify-credential";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import { prisma } from "@/lib/prisma";

type ApplyEnvsBody = {
  projectApplicationId?: string;
  confirmationText?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<ApplyEnvsBody>(request);

    const projectApplicationId = String(body.projectApplicationId ?? "").trim();
    const confirmationText = String(body.confirmationText ?? "").trim();

    if (!projectApplicationId) {
      return fail("Informe a aplicação planejada.", 400);
    }

    if (!(await hasCoolifyCredential())) {
      return fail("Configure a credencial do Coolify em Configurações.", 400);
    }

    const application = await prisma.projectApplication.findUnique({
      where: { id: projectApplicationId },
      include: {
        coolifyApplication: true,
        coolifyServer: true,
        coolifyProject: true
      }
    });

    if (!application) {
      return fail("Aplicação planejada não encontrada.", 404);
    }

    const expectedConfirmation = buildApplyEnvsConfirmationText(application.slug);

    if (confirmationText !== expectedConfirmation) {
      return fail(`Digite exatamente: ${expectedConfirmation}`, 400);
    }

    if (!application.coolifyApplicationId) {
      return fail("Aplicação ainda não está vinculada ao Coolify.", 400);
    }

    const result = await applyEnvsToCoolifyApplication({
      projectApplicationId: application.id,
      userId: user.id
    });

    return ok({
      message: result.message,
      skipped: result.skipped,
      application: toProjectApplication(result.application, { includeEnvironmentValues: true })
    });
  } catch (error) {
    if (error instanceof CoolifyPostProvisionError) {
      return fail(error.message, 400);
    }

    if (error instanceof CoolifyCredentialError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
