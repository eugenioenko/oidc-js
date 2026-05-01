import type { OidcDiscovery } from "./types.js";

/**
 * Builds an RP-Initiated Logout URL for ending the user's session at the OpenID Provider.
 * Returns `null` if the discovery document has no `end_session_endpoint`.
 *
 * @param discovery - The OIDC discovery document.
 * @param idToken - Optional ID token to pass as `id_token_hint` so the OP can identify the session.
 * @param postLogoutRedirectUri - Optional URI to redirect the user to after logout completes.
 * @returns The fully constructed logout URL, or `null` if the endpoint is not available.
 *
 * @see OpenID Connect RP-Initiated Logout 1.0 §2 -- Logout Request
 */
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
