/** Default token expiration buffer in seconds (30 seconds). */
export const DEFAULT_TOKEN_EXPIRATION_BUFFER = 30;

/** Returns the current time as a Unix timestamp in seconds. */
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Converts a relative `expires_in` value (seconds from now) to an absolute Unix timestamp.
 *
 * @param expiresIn - Token lifetime in seconds, as returned by the token endpoint (RFC 6749 §5.1).
 * @returns Absolute expiry time as a Unix timestamp in seconds.
 */
export function computeExpiresAt(expiresIn: number): number {
  return nowSeconds() + expiresIn;
}

/**
 * Checks whether a token has expired given an absolute expiration timestamp in seconds.
 * Returns `false` if `expiresAt` is null (the token is treated as non-expiring).
 *
 * @param expiresAt - Expiration time as a Unix timestamp in seconds, or null.
 * @param bufferSeconds - Buffer in seconds subtracted from expiry to account for clock skew and network latency.
 * @returns `true` if the current time is at or past the buffered expiry time.
 */
export function isExpiredAt(expiresAt: number | null, bufferSeconds: number = DEFAULT_TOKEN_EXPIRATION_BUFFER): boolean {
  if (expiresAt === null) return false;
  return nowSeconds() >= expiresAt - bufferSeconds;
}

/**
 * Returns the number of seconds remaining until the token expires.
 * Returns `Infinity` if `expiresAt` is null, or `0` if the token is already expired.
 *
 * @param expiresAt - Expiration time as a Unix timestamp in seconds, or null.
 * @returns Seconds remaining until expiry (never negative).
 */
export function timeUntilExpiry(expiresAt: number | null): number {
  if (expiresAt === null) return Infinity;
  return Math.max(0, expiresAt - nowSeconds());
}
