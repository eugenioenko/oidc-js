import type { OidcConfig } from "oidc-js-core";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

import type { LoginOptions } from "oidc-js";

/**
 * Actions available on the OIDC service for triggering auth operations.
 */
export interface AuthActions {
  /** Initiates the OIDC login flow by redirecting to the authorization endpoint. */
  login: (options?: LoginOptions) => void;
  /** Logs out the user by clearing state and redirecting to the end-session endpoint. */
  logout: () => void;
  /** Refreshes the current token set using the stored refresh token. */
  refresh: () => Promise<void>;
  /** Fetches the user's profile from the userinfo endpoint. */
  fetchProfile: () => Promise<void>;
}

/**
 * Configuration options for the Ember OIDC service.
 */
export interface EmberOidcConfig {
  /** Core OIDC configuration including issuer, clientId, and redirectUri. */
  config: OidcConfig;
  /** Whether to automatically fetch the userinfo profile after login. Defaults to true. */
  fetchProfile?: boolean;
  /** Callback invoked after a successful login, receiving the returnTo path. */
  onLogin?: (returnTo: string) => void;
  /** Callback invoked when an authentication error occurs. */
  onError?: (error: Error) => void;
}
