import type { OidcConfig, OidcUser } from "oidc-js-core";

/**
 * Decoded claims from an ID token payload per RFC 7519 and OpenID Connect Core section 2.
 */
export interface IdTokenClaims {
  /** Subject identifier for the end-user. */
  sub: string;
  /** Issuer identifier (URL) of the token. */
  iss: string;
  /** Audience(s) the token is intended for. */
  aud: string | string[];
  /** Expiration time as a Unix timestamp in seconds. */
  exp: number;
  /** Issued-at time as a Unix timestamp in seconds. */
  iat: number;
  /** Nonce value used to associate a client session with an ID token. */
  nonce?: string;
  /** Additional claims present in the token. */
  [claim: string]: unknown;
}

/**
 * Represents the authenticated user, combining ID token claims with an optional userinfo profile.
 */
export interface AuthUser {
  /** Decoded claims from the ID token. */
  claims: IdTokenClaims;
  /** Userinfo endpoint response, or null if not fetched. */
  profile: OidcUser | null;
}

/**
 * Holds the current set of OAuth 2.0 tokens obtained from the authorization server.
 */
export interface AuthTokens {
  /** The access token string, or null if not yet obtained. */
  access: string | null;
  /** The ID token string, or null if not returned. */
  id: string | null;
  /** The refresh token string, or null if not returned. */
  refresh: string | null;
  /** Access token expiration as a Unix timestamp in milliseconds, or null if unknown. */
  expiresAt: number | null;
}

/**
 * Options for the {@link OidcClient.login} method.
 */
export interface LoginOptions {
  /** URL to redirect the user back to after login completes. Defaults to the current location. */
  returnTo?: string;
  /** Additional query parameters to include in the authorization request. */
  extraParams?: Record<string, string>;
}

/**
 * Configuration for {@link OidcClient}, extending the core `OidcConfig` with client-specific options.
 */
export interface OidcClientConfig extends OidcConfig {
  /** Whether to fetch the userinfo profile after token exchange. Defaults to true. */
  fetchProfile?: boolean;
}

/**
 * Reactive authentication state exposed by {@link OidcClient}.
 */
export interface AuthState {
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
}
