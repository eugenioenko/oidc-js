import type { OidcConfig, OidcDiscovery, HttpRequest, IntrospectionResponse } from "./types.js";
import { OidcError } from "./errors.js";
import { buildClientAuthHeaders } from "./auth.js";

/**
 * Builds an HTTP request for token introspection using HTTP Basic client authentication.
 * Returns `null` if the discovery document has no `introspection_endpoint`.
 *
 * @param discovery - The OIDC discovery document.
 * @param config - The OIDC client configuration (must include `clientSecret`).
 * @param token - The token to introspect.
 * @returns An {@link HttpRequest} for the introspection endpoint, or `null` if the endpoint is not available.
 * @throws {@link OidcError} with code `MISSING_CLIENT_SECRET` if `clientSecret` is not configured.
 *
 * @see RFC 7662 §2.1 -- Introspection Request
 */
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

/**
 * Parses and validates a token introspection response, ensuring the required `active` field is present.
 *
 * @param data - The parsed JSON body returned from the introspection endpoint.
 * @returns The validated {@link IntrospectionResponse}.
 * @throws {@link OidcError} with code `TOKEN_EXCHANGE_ERROR` if the response is not an object or `active` is missing.
 *
 * @see RFC 7662 §2.2 -- Introspection Response
 */
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
