import { getCurrentUser } from "@/lib/server/current-user";
import { fail, ok } from "@/lib/server/http";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return fail("Sessão inválida.", 401);
  }

  return ok({ user });
}
