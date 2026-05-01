import type { OidcConfig, OidcDiscovery, HttpRequest, TokenSet } from "./types.js";
import { OidcError } from "./errors.js";
import { decodeJwtPayload } from "./jwt.js";

function buildClientAuth(config: OidcConfig): Record<string, string> {
  if (!config.clientSecret) return {};
  // RFC 6749 §2.3.1: HTTP Basic authentication with client_id:client_secret
  const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
  return { Authorization: `Basic ${credentials}` };
}

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
      ...buildClientAuth(config),
    },
    body: body.toString(),
  };
}

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
      ...buildClientAuth(config),
    },
    body: body.toString(),
  };
}

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
