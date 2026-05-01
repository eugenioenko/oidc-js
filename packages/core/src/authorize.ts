import type { OidcConfig, OidcDiscovery } from "./types.js";
import { OidcError } from "./errors.js";

// RFC 6749 §4.1.1: Authorization Request
// RFC 7636 §4.3: code_challenge and code_challenge_method
// OIDC Core §3.1.2.1: scope MUST contain openid, nonce binds session to ID token
export function buildAuthUrl(
  discovery: OidcDiscovery,
  config: OidcConfig,
  pkce: { verifier: string; challenge: string },
  state: string,
  nonce: string,
  extraParams?: Record<string, string>,
): string {
  if (!config.redirectUri) {
    throw new OidcError("MISSING_REDIRECT_URI", "redirectUri is required for authorization requests");
  }

  // RFC 6749 §4.1.1: required parameters
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: (config.scopes ?? ["openid", "profile", "email"]).join(" "),
    state,
    nonce,
    // RFC 7636 §4.3: PKCE parameters
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    ...extraParams,
  });

  return `${discovery.authorization_endpoint}?${params.toString()}`;
}

// RFC 6749 §4.1.2: Authorization Response
// RFC 6749 §10.12: state parameter MUST match for CSRF protection
export function parseCallbackUrl(url: string, expectedState: string): { code: string; state: string } {
  const parsed = new URL(url);
  const error = parsed.searchParams.get("error");

  // RFC 6749 §4.1.2.1: Error Response
  if (error) {
    const description = parsed.searchParams.get("error_description") ?? error;
    throw new OidcError("AUTHORIZATION_ERROR", description);
  }

  const code = parsed.searchParams.get("code");
  if (!code) {
    throw new OidcError("MISSING_AUTH_CODE", "No authorization code in callback URL");
  }

  const returnedState = parsed.searchParams.get("state");
  // RFC 6749 §10.12: the client MUST verify that the state matches
  if (returnedState !== expectedState) {
    throw new OidcError("STATE_MISMATCH", "State parameter does not match — possible CSRF attack");
  }

  return { code, state: returnedState };
}
