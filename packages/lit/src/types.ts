import type { OidcConfig } from "oidc-js-core";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

import type { LoginOptions } from "oidc-js";

/**
 * Actions available on the {@link AuthController} for triggering authentication operations.
 */
export interface AuthActions {
  /** Initiates the Authorization Code + PKCE login flow. */
  login: (options?: LoginOptions) => void;
  /** Logs the user out and redirects to the OP's end-session endpoint. */
  logout: () => void;
  /** Uses the stored refresh token to obtain new tokens. */
  refresh: () => Promise<void>;
  /** Fetches the user's profile from the userinfo endpoint. */
  fetchProfile: () => Promise<void>;
}

/**
 * Options passed to the {@link AuthController} constructor.
 */
export interface AuthControllerOptions {
  /** OIDC configuration including issuer, clientId, and redirectUri. */
  config: OidcConfig;
  /** Whether to fetch the userinfo profile after token exchange. Defaults to true. */
  fetchProfile?: boolean;
  /**
   * Called after a successful login callback with the `returnTo` path.
   * If not provided, the controller calls `window.history.replaceState` to update the URL.
   */
  onLogin?: (returnTo: string) => void;
  /** Called when an authentication error occurs. */
  onError?: (error: Error) => void;
}
