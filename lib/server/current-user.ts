import { getSessionFromRequest } from "@/lib/auth/session";

export async function requireCurrentUser(request: Request) {
  const user = await getSessionFromRequest(request);

  if (!user) {
    throw new Error("Sessão inválida.");
  }

  return user;
}
