export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers ?? {})
      }
    });
  } catch {
    throw new Error("Não foi possível conectar ao servidor do MiniHost.");
  }

  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "Operação não concluída.";
    throw new Error(message);
  }

  return payload as T;
}
