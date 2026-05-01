import type { OidcConfig, OidcDiscovery, HttpRequest, IntrospectionResponse } from "./types.js";
import { OidcError } from "./errors.js";
import { buildClientAuthHeaders } from "./auth.js";

// RFC 7662 §2.1: Introspection Request
export function buildIntrospectRequest(
  discovery: OidcDiscovery,
  config: OidcConfig,
  token: string,
): HttpRequest | null {
  if (!discovery.introspection_endpoint) {
    return null;
  }

  if (!config.clientSecret) {
    throw new OidcError("MISSING_CLIENT_SECRET", "clientSecret is required for token introspection");
  }

  const body = new URLSearchParams({ token });

  return {
    url: discovery.introspection_endpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...buildClientAuthHeaders(config),
    },
    body: body.toString(),
  };
}

// RFC 7662 §2.2: Introspection Response
export function parseIntrospectResponse(data: unknown): IntrospectionResponse {
  if (!data || typeof data !== "object") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "Introspection response must be a JSON object");
  }

  const response = data as Record<string, unknown>;

  if (typeof response.active !== "boolean") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "Missing or invalid 'active' field in introspection response");
  }

  return data as IntrospectionResponse;
}
