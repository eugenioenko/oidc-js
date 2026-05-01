import type { OidcConfig } from "oidc-js-core";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

import type { AuthUser, AuthTokens, LoginOptions } from "oidc-js";

/** Actions available for controlling the authentication lifecycle. */
export interface AuthActions {
  /** Initiates the OIDC login flow. */
  login: (options?: LoginOptions) => void;
  /** Logs the user out and optionally redirects to the OP's end-session endpoint. */
  logout: () => void;
  /** Refreshes the access token using the stored refresh token. */
  refresh: () => Promise<void>;
  /** Fetches the user's profile from the userinfo endpoint. */
  fetchProfile: () => Promise<void>;
}

/** The value provided by {@link AuthProvider} and consumed by {@link useAuth}. */
export interface AuthContextValue {
  /** The OIDC configuration used by the provider. */
  config: OidcConfig;
  /** The authenticated user, or null if not logged in. */
  user: AuthUser | null;
  /** Whether the user is currently authenticated. */
  isAuthenticated: boolean;
  /** Whether initialization or a token exchange is in progress. */
  isLoading: boolean;
  /** The most recent authentication error, or null if none. */
  error: Error | null;
  /** Current set of OAuth 2.0 tokens. */
  tokens: AuthTokens;
  /** Actions for controlling the authentication lifecycle. */
  actions: AuthActions;
}
