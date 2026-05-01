import type { AuthState } from "oidc-js-core";

const STORAGE_KEY = "oidc-js:auth-state";

/**
 * Persists the PKCE and OIDC auth state to `sessionStorage` so it survives the authorization redirect.
 *
 * @param authState - The auth state containing code verifier, state, nonce, and redirect URI.
 */
export function saveAuthState(authState: AuthState): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authState));
}

/**
 * Loads the previously saved auth state from `sessionStorage`.
 *
 * @returns The parsed auth state, or null if nothing is stored or the value is malformed.
 */
export function loadAuthState(): AuthState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

/**
 * Removes the auth state from `sessionStorage`, typically after a successful token exchange.
 */
export function clearAuthState(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
