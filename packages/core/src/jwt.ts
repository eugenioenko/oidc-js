import type { OidcUser } from "./types.js";
import { OidcError } from "./errors.js";

/**
 * Decodes the payload of a JWT without verifying its signature (RFC 7519 §7.2).
 * Performs base64url decoding and JSON parsing only.
 *
 * @param token - A compact-serialized JWT string (header.payload.signature).
 * @returns The decoded payload as a key-value record.
 * @throws {@link OidcError} with code `INVALID_JWT` if the token does not have three parts or the payload cannot be decoded.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new OidcError("INVALID_JWT", "JWT must have 3 parts separated by dots");
  }

  try {
    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    throw new OidcError("INVALID_JWT", "Failed to decode JWT payload");
  }
}

/**
 * Extracts standard OIDC claims from an ID token by decoding its payload (OpenID Connect Core 1.0 §2).
 * Does not verify the token signature.
 *
 * @param idToken - A compact-serialized ID token JWT.
 * @returns The decoded claims as an {@link OidcUser}.
 */
// OIDC Core §2: ID token claims
export function parseIdTokenClaims(idToken: string): OidcUser {
  const claims = decodeJwtPayload(idToken);
  return claims as OidcUser;
}
