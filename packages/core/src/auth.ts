import type { OidcConfig } from "./types.js";

// RFC 6749 §2.3.1: HTTP Basic authentication with client_id:client_secret
export function buildClientAuthHeaders(config: OidcConfig): Record<string, string> {
  if (!config.clientSecret) return {};
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
  return { Authorization: `Basic ${credentials}` };
}
