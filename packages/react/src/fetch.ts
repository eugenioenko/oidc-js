import type { HttpRequest } from "oidc-js-core";

export async function executeFetch(
  request: HttpRequest,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    signal,
  });

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    if (
      errorBody &&
      typeof errorBody === "object" &&
      "error" in errorBody
    ) {
      const desc =
        (errorBody as Record<string, unknown>).error_description ??
        (errorBody as Record<string, unknown>).error;
      throw new Error(`Token error: ${desc}`);
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
