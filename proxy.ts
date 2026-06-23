import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const publicPaths = ["/login"];
const authApiPaths = ["/api/auth/login", "/api/auth/logout", "/api/auth/me"];
const routeAliases: Record<string, string> = {
  "/dominios": "/domains",
  "/registros": "/records",
  "/templates-dns": "/templates",
  "/historico": "/history",
  "/configuracoes": "/settings"
};

function isPublicAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg")
  );
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicAsset(pathname) || authApiPaths.includes(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = await verifySessionToken(token);

  if (publicPaths.includes(pathname)) {
    if (user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  if (!user) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    return redirectToLogin(request);
  }

  const aliasTarget = routeAliases[pathname];

  if (aliasTarget) {
    return NextResponse.redirect(new URL(aliasTarget, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.).*)"]
};
