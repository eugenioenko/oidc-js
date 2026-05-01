/**
 * Client configuration for an OIDC/OAuth 2.0 provider.
 *
 * Supports both public clients (no `clientSecret`) and confidential clients.
 * See RFC 6749 Section 2.1 for client type definitions.
 */
export interface OidcConfig {
  /** Issuer identifier URL (must match the discovery document's `issuer` field). */
  issuer: string;
  /** OAuth 2.0 client identifier issued during registration (RFC 6749 Section 2.2). */
  clientId: string;
  /** Client secret for confidential clients (RFC 6749 Section 2.3.1). Omit for public clients. */
  clientSecret?: string;
  /** Redirection URI for authorization code responses (RFC 6749 Section 3.1.2). */
  redirectUri?: string;
  /** OAuth 2.0 scopes to request. Defaults to `["openid"]` if omitted. */
  scopes?: string[];
  /** URI to redirect to after logout (OpenID Connect RP-Initiated Logout 1.0). */
  postLogoutRedirectUri?: string;
}

/**
 * OpenID Provider discovery metadata as defined in OpenID Connect Discovery 1.0 Section 3.
 *
 * Required and optional fields mirror the provider's `/.well-known/openid-configuration` response.
 */
export interface OidcDiscovery {
  /** Issuer identifier (must exactly match the `issuer` in {@link OidcConfig}). */
  issuer: string;
  /** URL of the authorization endpoint (RFC 6749 Section 3.1). */
  authorization_endpoint: string;
  /** URL of the token endpoint (RFC 6749 Section 3.2). */
  token_endpoint: string;
  /** URL of the UserInfo endpoint (OpenID Connect Core 1.0 Section 5.3). */
  userinfo_endpoint: string;
  /** URL of the provider's JSON Web Key Set document (RFC 7517). */
  jwks_uri: string;
  /** URL of the end-session endpoint (OpenID Connect RP-Initiated Logout 1.0). */
  end_session_endpoint?: string;
  /** URL of the token revocation endpoint (RFC 7009). */
  revocation_endpoint?: string;
  /** URL of the token introspection endpoint (RFC 7662). */
  introspection_endpoint?: string;
  /** Response types the provider supports (OpenID Connect Discovery 1.0 Section 3). */
  response_types_supported: string[];
  /** Subject identifier types the provider supports (`public`, `pairwise`). */
  subject_types_supported: string[];
  /** JWS signing algorithms supported for ID tokens (RFC 7518). */
  id_token_signing_alg_values_supported: string[];
  /** Scopes the provider supports. */
  scopes_supported?: string[];
  /** Client authentication methods supported at the token endpoint. */
  token_endpoint_auth_methods_supported?: string[];
  /** PKCE code challenge methods supported (RFC 7636 Section 4.3). */
  code_challenge_methods_supported?: string[];
  /** Grant types the provider supports (RFC 6749 Section 1.3). */
  grant_types_supported?: string[];
  /** Claims the provider can supply. */
  claims_supported?: string[];
  /** Prompt values the provider supports (OpenID Connect Core 1.0 Section 3.1.2.1). */
  prompt_values_supported?: string[];
}

/**
 * Raw token endpoint response as defined in RFC 6749 Section 5.1.
 */
export interface TokenResponse {
  /** The access token issued by the authorization server. */
  access_token: string;
  /** Token type (typically `"Bearer"`, per RFC 6750). */
  token_type: string;
  /** Lifetime of the access token in seconds. */
  expires_in?: number;
  /** Refresh token for obtaining new access tokens (RFC 6749 Section 1.5). */
  refresh_token?: string;
  /** ID token containing user claims (OpenID Connect Core 1.0 Section 2). */
  id_token?: string;
  /** Space-delimited list of granted scopes. */
  scope?: string;
}

/**
 * Extended token response that includes a computed absolute expiration timestamp.
 *
 * Produced by {@link parseTokenResponse} from a raw {@link TokenResponse}.
 */
export interface TokenSet extends TokenResponse {
  /** Absolute expiration time as a Unix timestamp in milliseconds, computed from `expires_in`. */
  expires_at?: number;
}

/**
 * State stored before redirecting to the authorization endpoint.
 *
 * Used to validate the callback and complete the token exchange.
 */
export interface AuthState {
  /** PKCE code verifier (RFC 7636 Section 4.1). */
  codeVerifier: string;
  /** Anti-CSRF state parameter (RFC 6749 Section 10.12). */
  state: string;
  /** Nonce binding the ID token to this session (OpenID Connect Core 1.0 Section 3.1.2.1). */
  nonce: string;
  /** Redirect URI used for this authorization request. */
  redirectUri: string;
  /** Application route to restore after login completes. */
  returnTo?: string;
}

/**
 * Decoded user claims from the UserInfo endpoint or an ID token.
 *
 * Standard claims follow OpenID Connect Core 1.0 Section 5.1. Additional
 * provider-specific claims are accessible via the index signature.
 */
export interface OidcUser {
  /** Subject identifier -- unique, stable user ID (OpenID Connect Core 1.0 Section 2). */
  sub: string;
  /** User's email address. */
  email?: string;
  /** User's full display name. */
  name?: string;
  /** User's preferred short-form username. */
  preferred_username?: string;
  /** Additional claims not covered by the named fields. */
  [claim: string]: unknown;
}

/**
 * A prepared HTTP request ready to be executed by the caller's HTTP layer.
 *
 * Core functions return this instead of calling `fetch` directly, preserving the
 * "functional core, imperative shell" architecture.
 */
export interface HttpRequest {
  /** Fully qualified request URL. */
  url: string;
  /** HTTP method (e.g., `"POST"`, `"GET"`). */
  method: string;
  /** HTTP headers to include with the request. */
  headers: Record<string, string>;
  /** Request body, typically `application/x-www-form-urlencoded` for token requests. */
  body?: string;
}

/**
 * Token introspection response as defined in RFC 7662 Section 2.2.
 */
export interface IntrospectionResponse {
  /** Whether the token is currently active. */
  active: boolean;
  /** Space-delimited scopes associated with the token. */
  scope?: string;
  /** Client identifier for the token. */
  client_id?: string;
  /** Human-readable identifier for the resource owner. */
  username?: string;
  /** Token type (e.g., `"Bearer"`). */
  token_type?: string;
  /** Expiration time as a Unix timestamp in seconds (RFC 7662 Section 2.2). */
  exp?: number;
  /** Issued-at time as a Unix timestamp in seconds. */
  iat?: number;
  /** Subject of the token. */
  sub?: string;
  /** Audience the token is intended for. */
  aud?: string;
  /** Issuer of the token. */
  iss?: string;
}
