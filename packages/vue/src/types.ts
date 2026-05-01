import type { OidcConfig } from "oidc-js-core";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

import type { AuthUser, AuthTokens, LoginOptions } from "oidc-js";

/**
 * Actions available for authentication operations.
 *
 * Returned by {@link useAuth} to allow components to trigger login, logout,
 * token refresh, and profile fetching.
 */
export interface AuthActions {
  /** Initiates the Authorization Code + PKCE login flow. */
  login: (options?: LoginOptions) => void;
  /** Logs the user out and redirects to the OP's end-session endpoint. */
  logout: () => void;
  /** Uses the stored refresh token to obtain a new set of tokens. */
  refresh: () => Promise<void>;
  /** Fetches the user's profile from the userinfo endpoint. */
  fetchProfile: () => Promise<void>;
}

/**
 * The authentication state and actions exposed by the {@link useAuth} composable.
 *
 * Contains the current user, authentication status, tokens, and action methods.
 */
export interface AuthContextValue {
  /** The OIDC configuration used to initialize the client. */
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
  /** Actions for login, logout, refresh, and profile fetching. */
  actions: AuthActions;
}

/**
 * Options for the {@link oidcPlugin} Vue plugin.
 *
 * Configures the OIDC client with provider details, callback hooks,
 * and optional behavior flags.
 */
export interface OidcPluginOptions {
  /** OIDC configuration including issuer, clientId, and redirectUri. */
  config: OidcConfig;
  /** Whether to fetch the userinfo profile after token exchange. Defaults to true. */
  fetchProfile?: boolean;
  /** Callback invoked after a successful login with the returnTo path. */
  onLogin?: (returnTo: string) => void;
  /** Callback invoked when an authentication error occurs. */
  onError?: (error: Error) => void;
}
