import type { OidcDiscovery } from "./types.js";

// OIDC RP-Initiated Logout §2: Logout Request
export function buildLogoutUrl(
  discovery: OidcDiscovery,
  idToken?: string,
  postLogoutRedirectUri?: string,
): string | null {
  if (!discovery.end_session_endpoint) {
    return null;
  }

  const params = new URLSearchParams();

  // OIDC RP-Initiated Logout §2: id_token_hint — previously issued ID token
  if (idToken) {
    params.set("id_token_hint", idToken);
  }

  // OIDC RP-Initiated Logout §2: post_logout_redirect_uri — where to redirect after logout
  if (postLogoutRedirectUri) {
    params.set("post_logout_redirect_uri", postLogoutRedirectUri);
  }

  const query = params.toString();
  return query ? `${discovery.end_session_endpoint}?${query}` : discovery.end_session_endpoint;
}
