import type { OidcConfig, OidcDiscovery, HttpRequest } from "./types.js";
import { buildClientAuthHeaders } from "./auth.js";

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

  return {
    url: discovery.revocation_endpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...buildClientAuthHeaders(config),
    },
    body: body.toString(),
  };
}
