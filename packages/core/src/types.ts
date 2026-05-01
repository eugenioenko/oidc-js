export interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  postLogoutRedirectUri?: string;
}

export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  response_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
  claims_supported?: string[];
  prompt_values_supported?: string[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

export interface TokenSet extends TokenResponse {
  expires_at?: number;
}

export interface AuthState {
  codeVerifier: string;
  state: string;
  nonce: string;
  redirectUri: string;
}

export interface OidcUser {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  [claim: string]: unknown;
}

export interface HttpRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  aud?: string;
  iss?: string;
}
