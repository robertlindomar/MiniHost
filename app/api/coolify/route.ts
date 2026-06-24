import { getCoolifyClientStatus } from "@/lib/server/coolify-credential";
import { getCoolifyCachedResources } from "@/lib/server/coolify-cache";
import { requireCurrentUser } from "@/lib/server/current-user";
import { handleRouteError, ok } from "@/lib/server/http";
import { toCoolifyApplication, toCoolifyProject, toCoolifyServer } from "@/lib/server/mappers";

export async function GET(request: Request) {
  try {
    await requireCurrentUser(request);
    const [coolify, cached] = await Promise.all([
      getCoolifyClientStatus(),
      getCoolifyCachedResources({ includeRemoved: true })
    ]);

    return ok({
      coolify,
      servers: cached.servers.map(toCoolifyServer),
      projects: cached.projects.map(toCoolifyProject),
      applications: cached.applications.map(toCoolifyApplication)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
