import type { OidcConfig } from "oidc-js-core";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";

/**
 * Configuration options for {@link provideAuth}.
 *
 * Extends the core OIDC configuration with adapter-specific callbacks
 * for handling login navigation and errors.
 */
export interface AuthProviderOptions {
  /** Core OIDC configuration (issuer, clientId, redirectUri, scopes, etc.). */
  config: OidcConfig;
  /** Whether to fetch the userinfo profile after token exchange. Defaults to `true`. */
  fetchProfile?: boolean;
  /**
   * Called after a successful login callback with the `returnTo` path.
   * If not provided, the adapter uses Angular's `Router.navigateByUrl` to navigate.
   */
  onLogin?: (returnTo: string) => void;
  /** Called when an authentication error occurs. */
  onError?: (error: Error) => void;
}
