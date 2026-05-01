import type { OidcConfig } from "oidc-js-core";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

import type { AuthUser, AuthTokens, LoginOptions } from "oidc-js";

/**
 * Actions available for controlling authentication flow.
 *
 * Returned as part of the {@link AuthContextValue} from {@link useAuth}.
 */
export interface AuthActions {
  /** Starts the Authorization Code + PKCE login flow. */
  login: (options?: LoginOptions) => void;
  /** Logs out the current user and clears auth state. */
  logout: () => void;
  /** Refreshes the access token using the stored refresh token. */
  refresh: () => Promise<void>;
  /** Fetches the user's profile from the userinfo endpoint. */
  fetchProfile: () => Promise<void>;
}

/**
 * The authentication context value exposed by {@link useAuth}.
 *
 * All properties are reactive SolidJS accessors backed by signals.
 */
export interface AuthContextValue {
  /** The OIDC configuration used to initialize the provider. */
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
