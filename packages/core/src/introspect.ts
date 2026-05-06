import type { OidcConfig, OidcDiscovery, HttpRequest, IntrospectionResponse } from "./types.js";
import { OidcErrors } from "./errors.js";
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
    throw OidcErrors.missingClientSecret();
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
 * @throws {@link OidcError} with code `INTROSPECTION_ERROR` if the response is not an object or `active` is missing.
 *
 * @see RFC 7662 §2.2 -- Introspection Response
 */
// RFC 7662 §2.2: Introspection Response
export function parseIntrospectResponse(data: unknown): IntrospectionResponse {
  if (!data || typeof data !== "object") {
    throw OidcErrors.introspectionNotObject();
  }

  const response = data as Record<string, unknown>;

  if (typeof response.active !== "boolean") {
    throw OidcErrors.introspectionMissingActive();
  }

  return data as IntrospectionResponse;
}
