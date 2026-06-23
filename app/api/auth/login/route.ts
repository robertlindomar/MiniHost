import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type SessionUser
} from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, readBody } from "@/lib/server/http";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const body = await readBody<LoginBody>(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return fail("Email ou senha inválidos", 401);
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return fail("Email ou senha inválidos", 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return fail("Email ou senha inválidos", 401);
    }

    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
    const token = await createSessionToken(sessionUser);
    const response = NextResponse.json({ user: sessionUser });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
