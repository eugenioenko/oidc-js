import type { OidcUser } from "./types.js";
import { OidcError } from "./errors.js";

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

// OIDC Core §2: ID token claims
export function parseIdTokenClaims(idToken: string): OidcUser {
  const claims = decodeJwtPayload(idToken);
  return claims as OidcUser;
}
