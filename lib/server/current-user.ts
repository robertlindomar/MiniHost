import { getSessionFromRequest, type SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function toSessionUser(user: { id: string; name: string; email: string; role: "ADMIN" | "USER" }): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

export async function getCurrentUser(request: Request) {
  const sessionUser = await getSessionFromRequest(request);

  if (!sessionUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true
    }
  });

  if (!user || user.email !== sessionUser.email) {
    return null;
  }

  return toSessionUser(user);
}

export async function requireCurrentUser(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new Error("Sessão inválida.");
  }

  return user;
}
