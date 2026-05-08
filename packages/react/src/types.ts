export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

import type { OidcClient, OidcClientConfig, AuthUser, AuthTokens, LoginOptions } from "oidc-js";
import type { OidcUser } from "oidc-js-core";

export interface AuthActions {
  login: (options?: LoginOptions) => void;
  logout: () => void;
  refresh: () => Promise<AuthTokens>;
  fetchProfile: () => Promise<OidcUser | null>;
}

export interface AuthContextValue {
  config: OidcClientConfig;
  client: OidcClient;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  tokens: AuthTokens;
  actions: AuthActions;
}
