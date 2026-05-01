import type { HttpRequest } from "oidc-js-core";

/**
 * Executes an HTTP request built by oidc-js-core and returns the parsed JSON response.
 * Throws on non-OK responses, surfacing OAuth 2.0 error descriptions when available.
 *
 * @param request - The {@link HttpRequest} descriptor (url, method, headers, body) from a core builder function.
 * @param signal - Optional `AbortSignal` to cancel the request.
 * @returns The parsed JSON response body.
 */
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
