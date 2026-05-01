import type { OidcDiscovery, HttpRequest, OidcUser } from "./types.js";

// OIDC Core §5.3.1: UserInfo Request
// RFC 6750 §2.1: Bearer token in Authorization header
export function buildUserinfoRequest(discovery: OidcDiscovery, accessToken: string): HttpRequest {
  return {
    url: discovery.userinfo_endpoint,
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: "",
  };
}

// OIDC Core §5.3.2: UserInfo Response — standard claims
export function parseUserinfoResponse(data: unknown): OidcUser {
  return data as OidcUser;
}
