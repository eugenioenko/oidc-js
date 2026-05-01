import type { OidcConfig, OidcDiscovery, HttpRequest, TokenSet } from "./types.js";
import { OidcError } from "./errors.js";
import { decodeJwtPayload } from "./jwt.js";
import { buildClientAuthHeaders } from "./auth.js";

/**
 * Builds an HTTP request to exchange an authorization code for tokens (RFC 6749 §4.1.3).
 *
 * @param discovery - The OIDC discovery document containing the token endpoint.
 * @param config - Client configuration (clientId, redirectUri, optional clientSecret).
 * @param code - The authorization code received from the authorization endpoint.
 * @param codeVerifier - The PKCE code verifier that matches the code_challenge sent earlier (RFC 7636 §4.5).
 * @returns An {@link HttpRequest} ready to be sent to the token endpoint.
 */
// RFC 6749 §4.1.3: Access Token Request
// RFC 7636 §4.5: code_verifier MUST be sent when code_challenge was used
export function buildTokenRequest(
  discovery: OidcDiscovery,
  config: OidcConfig,
  code: string,
  codeVerifier: string,
): HttpRequest {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    client_id: config.clientId,
  });

  // RFC 6749 §4.1.3: redirect_uri MUST match the value used in the authorization request
  if (config.redirectUri) {
    body.set("redirect_uri", config.redirectUri);
  }

  return {
    url: discovery.token_endpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...buildClientAuthHeaders(config),
    },
    body: body.toString(),
  };
}

/**
 * Builds an HTTP request to refresh an access token using a refresh token (RFC 6749 §6).
 *
 * @param discovery - The OIDC discovery document containing the token endpoint.
 * @param config - Client configuration (clientId, optional clientSecret).
 * @param refreshToken - The refresh token previously issued by the authorization server.
 * @returns An {@link HttpRequest} ready to be sent to the token endpoint.
 */
// RFC 6749 §6: Refreshing an Access Token
export function buildRefreshRequest(
  discovery: OidcDiscovery,
  config: OidcConfig,
  refreshToken: string,
): HttpRequest {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
  });

  return {
    url: discovery.token_endpoint,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...buildClientAuthHeaders(config),
    },
    body: body.toString(),
  };
}

/**
 * Parses and validates a raw token endpoint response into a {@link TokenSet} (RFC 6749 §5.1).
 * Validates the nonce claim in the ID token when provided (OpenID Connect Core 1.0 §3.1.3.7).
 * Computes `expires_at` as an absolute Unix timestamp when `expires_in` is present.
 *
 * @param data - The parsed JSON body from the token endpoint response.
 * @param expectedNonce - If provided, the nonce claim in the ID token must match this value.
 * @returns A validated {@link TokenSet} with computed `expires_at`.
 * @throws {@link OidcError} with code `TOKEN_EXCHANGE_ERROR` if the response is malformed or missing `access_token`.
 * @throws {@link OidcError} with code `NONCE_MISMATCH` if the ID token nonce does not match.
 */
// RFC 6749 §5.1: Successful Response
// OIDC Core §3.1.3.7: nonce in ID token MUST match the nonce sent in the authorization request
export function parseTokenResponse(data: unknown, expectedNonce?: string): TokenSet {
  if (!data || typeof data !== "object") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "Token response must be a JSON object");
  }

  const response = data as Record<string, unknown>;

  if (typeof response.access_token !== "string") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "Missing access_token in token response");
  }

  // OIDC Core §3.1.3.7: if a nonce was sent, it MUST be present and match in the ID token
  if (expectedNonce && typeof response.id_token === "string") {
    const claims = decodeJwtPayload(response.id_token);
    if (claims.nonce !== expectedNonce) {
      throw new OidcError("NONCE_MISMATCH", "Nonce in ID token does not match the expected value");
    }
  }

  const tokenSet: TokenSet = {
    access_token: response.access_token as string,
    token_type: (response.token_type as string) ?? "Bearer",
    expires_in: response.expires_in as number | undefined,
    refresh_token: response.refresh_token as string | undefined,
    id_token: response.id_token as string | undefined,
    scope: response.scope as string | undefined,
  };

  // Compute absolute expiry timestamp
  if (tokenSet.expires_in !== undefined) {
    tokenSet.expires_at = Math.floor(Date.now() / 1000) + tokenSet.expires_in;
  }

  return tokenSet;
}
