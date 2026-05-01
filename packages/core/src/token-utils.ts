import type { TokenSet } from "./types.js";

/**
 * Converts a relative `expires_in` value (seconds from now) to an absolute Unix timestamp.
 *
 * @param expiresIn - Token lifetime in seconds, as returned by the token endpoint (RFC 6749 §5.1).
 * @returns Absolute expiry time as a Unix timestamp in seconds.
 */
export function computeExpiresAt(expiresIn: number): number {
  return Math.floor(Date.now() / 1000) + expiresIn;
}

/**
 * Checks whether the access token in a {@link TokenSet} has expired.
 * Returns `false` if no `expires_at` is set (the token is treated as non-expiring).
 *
 * @param tokenSet - The token set to check.
 * @param clockSkewSeconds - Optional allowance for clock drift between client and server (defaults to 0).
 * @returns `true` if the current time is at or past the adjusted expiry time.
 */
export function isTokenExpired(tokenSet: TokenSet, clockSkewSeconds: number = 0): boolean {
  if (tokenSet.expires_at === undefined) {
    return false;
  }
  return Math.floor(Date.now() / 1000) >= tokenSet.expires_at - clockSkewSeconds;
}

/**
 * Returns the number of seconds remaining until the token expires.
 * Returns `Infinity` if no `expires_at` is set, or `0` if the token is already expired.
 *
 * @param tokenSet - The token set to inspect.
 * @returns Seconds remaining until expiry (never negative).
 */
export function timeUntilExpiry(tokenSet: TokenSet): number {
  if (tokenSet.expires_at === undefined) {
    return Infinity;
  }
  const remaining = tokenSet.expires_at - Math.floor(Date.now() / 1000);
  return Math.max(0, remaining);
}
