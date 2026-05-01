import type { OidcDiscovery, HttpRequest, OidcUser } from "./types.js";
import { OidcError } from "./errors.js";

// OIDC Core §5.3.1: UserInfo Request
// RFC 6750 §2.1: Bearer token in Authorization header
export function buildUserinfoRequest(discovery: OidcDiscovery, accessToken: string): HttpRequest {
  return {
    url: discovery.userinfo_endpoint,
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

// OIDC Core §5.3.2: UserInfo Response
export function parseUserinfoResponse(data: unknown): OidcUser {
  if (!data || typeof data !== "object") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "UserInfo response must be a JSON object");
  }

  const response = data as Record<string, unknown>;

  // OIDC Core §5.3.2: sub claim is REQUIRED
  if (typeof response.sub !== "string") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "Missing or invalid 'sub' claim in UserInfo response");
  }

  return data as OidcUser;
}
