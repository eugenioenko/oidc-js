import type { AuthState } from "oidc-js-core";

const STORAGE_KEY = "oidc-js:auth-state";

export function saveAuthState(authState: AuthState): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(authState));
}

export function loadAuthState(): AuthState | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function clearAuthState(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}
