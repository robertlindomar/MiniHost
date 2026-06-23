import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function isDatabaseError(error: unknown) {
  return error instanceof Error && /database|connect|connection|ECONNREFUSED|P1001|P1000|Can't reach/i.test(error.message);
}

export function handleRouteError(error: unknown) {
  console.error(error);

  if (isDatabaseError(error)) {
    return fail("Não foi possível conectar ao banco de dados. Verifique o DATABASE_URL e se o PostgreSQL está ativo.", 503);
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
