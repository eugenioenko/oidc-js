import type { OidcConfig } from "./types.js";

/**
 * Builds HTTP Basic authentication headers from the client credentials.
 * Returns an empty object if `clientSecret` is not configured (public client).
 *
 * @param config - The OIDC client configuration.
 * @returns A headers record containing the `Authorization: Basic` header, or an empty record for public clients.
 *
 * @see RFC 6749 §2.3.1 -- Client Password (HTTP Basic)
 */
// RFC 6749 §2.3.1: HTTP Basic authentication with client_id:client_secret
export function buildClientAuthHeaders(config: OidcConfig): Record<string, string> {
  if (!config.clientSecret) return {};
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
  return { Authorization: `Basic ${credentials}` };
}
