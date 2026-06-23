import { getSessionFromRequest } from "@/lib/auth/session";
import { fail, ok } from "@/lib/server/http";

export async function GET(request: Request) {
  const user = await getSessionFromRequest(request);

  if (!user) {
    return fail("Sessão inválida.", 401);
  }

  return ok({ user });
}
