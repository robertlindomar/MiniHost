import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/server/current-user";
import { writeAudit } from "@/lib/server/audit";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import {
  buildEnvContent,
  decryptEnvironmentVariables,
  sanitizeEnvVariablesForAudit,
  sanitizeProjectApplicationForAudit
} from "@/lib/server/project-application";

type RouteContext = {
  params: Promise<{ id: string; applicationId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireCurrentUser(request);
    const { id, applicationId } = await context.params;
    const body = await readBody<{ confirmSensitive?: boolean }>(request);

    if (!body.confirmSensitive) {
      return fail("Confirme a ação sensível para gerar o .env com variáveis da aplicação.", 400);
    }

    const application = await prisma.projectApplication.findFirst({
      where: { id: applicationId, projectId: id }
    });

    if (!application) {
      return fail("Aplicação não encontrada.", 404);
    }

    const variables = decryptEnvironmentVariables(application.environmentVariablesEncrypted);

    await writeAudit(prisma, {
      action: "PROJECT_APPLICATION_ENV_GENERATED",
      entityType: "project_application",
      entityId: application.id,
      entityName: application.name,
      userId: user.id,
      description: `.env gerado para a aplicação ${application.name}.`,
      newData: {
        application: sanitizeProjectApplicationForAudit(application),
        variables: sanitizeEnvVariablesForAudit(variables)
      }
    });

    return ok({
      envContent: buildEnvContent(variables),
      warning: "Este .env pode conter credenciais sensíveis. Não compartilhe publicamente."
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
