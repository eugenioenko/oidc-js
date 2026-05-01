import type { OidcConfig, OidcDiscovery, HttpRequest, IntrospectionResponse } from "./types.js";
import { OidcError } from "./errors.js";

// RFC 7662 §2.1: Introspection Request
export function buildIntrospectRequest(
  discovery: OidcDiscovery,
  config: OidcConfig,
  token: string,
): HttpRequest {
  if (!config.clientSecret) {
    throw new OidcError("MISSING_CLIENT_SECRET", "clientSecret is required for token introspection");
  }

  // RFC 7662 §2.1: the protected resource authenticates with the authorization server
  // RFC 6749 §2.3.1: HTTP Basic authentication
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);

  const body = new URLSearchParams({ token });

  return {
    url: discovery.introspection_endpoint!,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: body.toString(),
  };
}

// RFC 7662 §2.2: Introspection Response
export function parseIntrospectResponse(data: unknown): IntrospectionResponse {
  return data as IntrospectionResponse;
}
