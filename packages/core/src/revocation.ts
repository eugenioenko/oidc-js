import type { OidcConfig, OidcDiscovery, HttpRequest } from "./types.js";

// RFC 7009 §2.1: Token Revocation Request
export function buildRevocationRequest(
  discovery: OidcDiscovery,
  config: OidcConfig,
  token: string,
  tokenTypeHint?: "access_token" | "refresh_token",
): HttpRequest | null {
  if (!discovery.revocation_endpoint) {
    return null;
  }

  const body = new URLSearchParams({ token, client_id: config.clientId });

  // RFC 7009 §2.1: token_type_hint is OPTIONAL
  if (tokenTypeHint) {
    body.set("token_type_hint", tokenTypeHint);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // RFC 6749 §2.3.1: confidential clients authenticate via Basic auth
  if (config.clientSecret) {
    const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
    headers["Authorization"] = `Basic ${credentials}`;
  }

  return {
    url: discovery.revocation_endpoint,
    method: "POST",
    headers,
    body: body.toString(),
  };
}
