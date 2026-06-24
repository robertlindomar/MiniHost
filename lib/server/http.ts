import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function isDatabaseError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;

  return /P1000|P1001|P1002|P1017/.test(message) || /Can't reach database server/i.test(message) || /ECONNREFUSED/i.test(message);
}

export function isPrismaSchemaError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = "code" in error ? (error as { code?: string }).code : undefined;

  return code === "P2022" || /column .* does not exist/i.test(error.message) || /table .* does not exist/i.test(error.message);
}

export function isPrismaForeignKeyError(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2003";
}

export function handleRouteError(error: unknown) {
  console.error(error);

  if (error instanceof Error && error.message === "Sessão inválida.") {
    return fail("Sessão inválida.", 401);
  }

  if (isDatabaseError(error)) {
    return fail("Não foi possível conectar ao banco de dados. Verifique o DATABASE_URL e se o PostgreSQL está ativo.", 503);
  }

  if (isPrismaSchemaError(error)) {
    return fail("Não foi possível salvar a aplicação. Execute as migrations pendentes do banco de dados.", 500);
  }

  if (isPrismaForeignKeyError(error)) {
    return fail("Banco vinculado não encontrado.", 400);
  }

  if (error instanceof Error) {
    return fail(error.message, 400);
  }

  return fail("Operação não concluída.", 500);
}

export async function readBody<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Corpo da requisição inválido.");
  }
}
