import type { OidcConfig, OidcDiscovery, HttpRequest } from "./types.js";
import { buildClientAuthHeaders } from "./auth.js";

/**
 * Builds an HTTP request to revoke an OAuth 2.0 token.
 * Returns `null` if the discovery document has no `revocation_endpoint`.
 *
 * @param discovery - The OIDC discovery document.
 * @param config - The OIDC client configuration.
 * @param token - The token to revoke (access or refresh token).
 * @param tokenTypeHint - Optional hint indicating whether the token is an `access_token` or `refresh_token`.
 * @returns An {@link HttpRequest} for the revocation endpoint, or `null` if the endpoint is not available.
 *
 * @see RFC 7009 §2.1 -- Token Revocation Request
 */
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
