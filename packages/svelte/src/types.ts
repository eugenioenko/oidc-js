import type { OidcConfig } from "oidc-js-core";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

import type { AuthUser, AuthTokens, LoginOptions } from "oidc-js";

/** Actions available to interact with the OIDC authentication flow. */
export interface AuthActions {
  /** Initiates the login flow by redirecting to the authorization endpoint. */
  login: (options?: LoginOptions) => void;
  /** Logs the user out and redirects to the end-session endpoint. */
  logout: () => void;
  /** Refreshes the access token using the stored refresh token. */
  refresh: () => Promise<void>;
  /** Fetches the user's profile from the userinfo endpoint. */
  fetchProfile: () => Promise<void>;
}

/** Reactive authentication context value provided by {@link AuthProvider}. */
export interface AuthContextValue {
  /** The OIDC configuration used by the provider. */
  readonly config: OidcConfig;
  /** The authenticated user, or null if not logged in. */
  readonly user: AuthUser | null;
  /** Whether the user is currently authenticated. */
  readonly isAuthenticated: boolean;
  /** Whether initialization or a token exchange is in progress. */
  readonly isLoading: boolean;
  /** The most recent authentication error, or null if none. */
  readonly error: Error | null;
  /** Current set of OAuth 2.0 tokens. */
  readonly tokens: AuthTokens;
  /** Actions to interact with the authentication flow. */
  readonly actions: AuthActions;
}
