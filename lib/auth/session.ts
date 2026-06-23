export const SESSION_COOKIE_NAME = "minihost_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionRole = "ADMIN" | "USER";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: SessionRole;
}

interface SessionPayload extends SessionUser {
  expiresAt: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getSecret() {
  return process.env.AUTH_SECRET || "minihost-dev-secret-change-me";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createSessionToken(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  };
  const encodedPayload = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = await sign(encodedPayload);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))) as SessionPayload;

    if (!payload.id || !payload.email || !payload.name || !payload.role || payload.expiresAt < Date.now()) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role
    };
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader: string | null) {
  const cookies = new Map<string, string>();

  if (!cookieHeader) {
    return cookies;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = cookie.trim().split("=");

    if (rawName) {
      cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
    }
  }

  return cookies;
}

export async function getSessionFromRequest(request: Request) {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return verifySessionToken(cookies.get(SESSION_COOKIE_NAME));
}
