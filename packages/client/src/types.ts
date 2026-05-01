import type { OidcConfig, OidcUser } from "oidc-js-core";

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

export interface OidcClientConfig extends OidcConfig {
  fetchProfile?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  tokens: AuthTokens;
}
