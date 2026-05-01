import type { TokenSet } from "./types.js";

export function computeExpiresAt(expiresIn: number): number {
  return Math.floor(Date.now() / 1000) + expiresIn;
}

export function isTokenExpired(tokenSet: TokenSet, clockSkewSeconds: number = 0): boolean {
  if (tokenSet.expires_at === undefined) {
    return false;
  }
  return Math.floor(Date.now() / 1000) >= tokenSet.expires_at - clockSkewSeconds;
}

export function timeUntilExpiry(tokenSet: TokenSet): number {
  if (tokenSet.expires_at === undefined) {
    return Infinity;
  }
  const remaining = tokenSet.expires_at - Math.floor(Date.now() / 1000);
  return Math.max(0, remaining);
}
