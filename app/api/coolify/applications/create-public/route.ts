import { buildApplicationProvisionConfirmationText } from "@/lib/provision";
import {
  CoolifyApplicationProvisionerError,
  provisionCoolifyApplication
} from "@/lib/server/coolify-application-provisioner";
import { hasCoolifyCredential, CoolifyCredentialError } from "@/lib/server/coolify-credential";
import {
  assertApplicationUsesProjectCoolifyProject,
  getProjectCoolifyProject,
  ProjectCoolifyProjectError
} from "@/lib/server/project-coolify-project";
import { requireCurrentUser } from "@/lib/server/current-user";
import { fail, handleRouteError, ok, readBody } from "@/lib/server/http";
import { toProjectApplication } from "@/lib/server/mappers";
import { prisma } from "@/lib/prisma";
import {
  canCreateInCoolify,
  isGitCompatibleApplicationType,
  isPublicGitRepository
} from "@/lib/coolify-provision";

type CreatePublicBody = {
  projectApplicationId?: string;
  coolifyServerId?: string;
  coolifyProjectId?: string;
  confirmationText?: string;
  applyEnvsAfterCreate?: boolean;
  deployAfterCreate?: boolean;
};

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser(request);
    const body = await readBody<CreatePublicBody>(request);

    const projectApplicationId = String(body.projectApplicationId ?? "").trim();
    const coolifyServerId = String(body.coolifyServerId ?? "").trim();
    const coolifyProjectId = String(body.coolifyProjectId ?? "").trim();
    const confirmationText = String(body.confirmationText ?? "").trim();

    if (!projectApplicationId) {
      return fail("Informe a aplicação planejada.", 400);
    }

    if (!coolifyServerId) {
      return fail("Selecione o servidor Coolify.", 400);
    }

    const application = await prisma.projectApplication.findUnique({
      where: { id: projectApplicationId },
      include: {
        project: true,
        coolifyServer: true,
        coolifyProject: true,
        coolifyApplication: true
      }
    });

    if (!application) {
      return fail("Aplicação planejada não encontrada.", 404);
    }

    const linkedCoolifyProject = await getProjectCoolifyProject(application.projectId);
    const resolvedCoolifyProjectId = coolifyProjectId || linkedCoolifyProject?.id || "";

    if (!resolvedCoolifyProjectId) {
      return fail("Crie ou vincule um projeto Coolify ao projeto MiniHost antes de provisionar aplicações.", 400);
    }

    if (coolifyProjectId && linkedCoolifyProject && coolifyProjectId !== linkedCoolifyProject.id) {
      try {
        await assertApplicationUsesProjectCoolifyProject(application.projectId, coolifyProjectId);
      } catch (error) {
        if (error instanceof ProjectCoolifyProjectError) {
          return fail(error.message, 400);
        }

        throw error;
      }
    }

    if (!(await hasCoolifyCredential())) {
      return fail("Configure a credencial do Coolify em Configurações.", 400);
    }

    const expectedConfirmation = buildApplicationProvisionConfirmationText(application.slug);

    if (confirmationText !== expectedConfirmation) {
      return fail(`Digite exatamente: ${expectedConfirmation}`, 400);
    }

    const [coolifyServer, coolifyProject] = await Promise.all([
      prisma.coolifyServer.findUnique({ where: { id: coolifyServerId } }),
      prisma.coolifyProject.findUnique({ where: { id: resolvedCoolifyProjectId } })
    ]);

    const eligibility = canCreateInCoolify({
      status: application.status as Parameters<typeof canCreateInCoolify>[0]["status"],
      type: application.type as Parameters<typeof canCreateInCoolify>[0]["type"],
      gitRepository: application.gitRepository,
      gitBranch: application.gitBranch,
      coolifyApplicationId: application.coolifyApplicationId,
      coolifyServerId,
      coolifyProjectId: resolvedCoolifyProjectId,
      hasCoolifyCredential: true,
      hasActiveServer: coolifyServer?.status === "ACTIVE",
      hasActiveProject: coolifyProject?.status === "ACTIVE"
    });

    if (!eligibility.allowed) {
      return fail(eligibility.reasons[0] ?? "Aplicação não elegível para criação no Coolify.", 400);
    }

    if (!isGitCompatibleApplicationType(application.type as Parameters<typeof isGitCompatibleApplicationType>[0])) {
      return fail("Tipo de aplicação incompatível com repositório Git público.", 400);
    }

    if (!isPublicGitRepository(application.gitRepository)) {
      return fail("Somente repositórios públicos via HTTPS são suportados nesta etapa.", 400);
    }

    const result = await provisionCoolifyApplication({
      projectApplicationId: application.id,
      coolifyServerId,
      coolifyProjectId: resolvedCoolifyProjectId,
      userId: user.id,
      applyEnvsAfterCreate: Boolean(body.applyEnvsAfterCreate),
      deployAfterCreate: Boolean(body.deployAfterCreate)
    });

    return ok({
      message: result.message,
      envWarning: result.envWarning,
      coolifyApplicationUuid: result.coolifyApplicationUuid,
      application: toProjectApplication(result.application, { includeEnvironmentValues: true })
    });
  } catch (error) {
    if (error instanceof CoolifyApplicationProvisionerError) {
      return fail(error.message, 400);
    }

    if (error instanceof CoolifyCredentialError) {
      return fail(error.message, 400);
    }

    return handleRouteError(error);
  }
}
