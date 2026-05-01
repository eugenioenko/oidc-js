import type { OidcConfig, OidcUser } from "oidc-js-core";

// OIDC Core 3.1.3.7: required ID token claims
export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  [claim: string]: unknown;
}

export interface AuthUser {
  claims: IdTokenClaims;
  profile: OidcUser | null;
}

export interface AuthTokens {
  access: string | null;
  id: string | null;
  refresh: string | null;
  expiresAt: number | null;
}

export interface LoginOptions {
  returnTo?: string;
  extraParams?: Record<string, string>;
}

export interface AuthActions {
  login: (options?: LoginOptions) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}

export interface AuthContextValue {
  config: OidcConfig;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  tokens: AuthTokens;
  actions: AuthActions;
}
