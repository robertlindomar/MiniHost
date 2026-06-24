import { buildDeployConfirmationText } from "@/lib/provision";
import {
  deployCoolifyApplication,
  CoolifyPostProvisionError
} from "@/lib/server/coolify-application-post-provision";
import { hasCoolifyCredential, CoolifyCredentialError } from "@/lib/server/coolify-credential";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import { prisma } from "@/lib/prisma";

type DeployBody = {
  projectApplicationId?: string;
  confirmationText?: string;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<DeployBody>(request);

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

    const expectedConfirmation = buildDeployConfirmationText(application.slug);

    if (confirmationText !== expectedConfirmation) {
      return fail(`Digite exatamente: ${expectedConfirmation}`, 400);
    }

    if (!application.coolifyApplicationId) {
      return fail("Aplicação ainda não está vinculada ao Coolify.", 400);
    }

    if (application.coolifyApplication?.status === "REMOVED" || application.coolifyApplication?.status === "MISSING") {
      return fail("Aplicação Coolify vinculada está ausente ou removida.", 400);
    }

    const result = await deployCoolifyApplication({
      projectApplicationId: application.id,
      userId: user.id
    });

    return ok({
      message: result.message,
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
