/**
 * Union of all typed error codes thrown by oidc-js-core.
 *
 * Each code maps to a specific validation or protocol failure defined in
 * RFC 6749, RFC 7636, RFC 7662, or OpenID Connect Core 1.0.
 */
export type OidcErrorCode =
  | "DISCOVERY_INVALID"
  | "DISCOVERY_ISSUER_MISMATCH"
  | "STATE_MISMATCH"
  | "NONCE_MISMATCH"
  | "MISSING_AUTH_CODE"
  | "INVALID_JWT"
  | "TOKEN_EXCHANGE_ERROR"
  | "AUTHORIZATION_ERROR"
  | "MISSING_REDIRECT_URI"
  | "MISSING_CLIENT_SECRET"
  | "USERINFO_ERROR"
  | "INTROSPECTION_ERROR";

/**
 * Structured error thrown by all oidc-js-core functions instead of generic `Error`.
 *
 * Consumers can switch on {@link OidcError.code} for programmatic error handling.
 */
export class OidcError extends Error {
  constructor(
    /** Typed error code identifying the failure category. */
    public readonly code: OidcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OidcError";
  }
}

export const OidcErrors = {
  discoveryNotObject: () =>
    new OidcError("DISCOVERY_INVALID", "Discovery response must be a JSON object"),
  discoveryMissingField: (field: string) =>
    new OidcError("DISCOVERY_INVALID", `Missing or invalid required field: ${field}`),
  discoveryIssuerMismatch: (expected: string, actual: string) =>
    new OidcError("DISCOVERY_ISSUER_MISMATCH", `Expected issuer "${expected}", got "${actual}"`),
  missingRedirectUri: () =>
    new OidcError("MISSING_REDIRECT_URI", "redirectUri is required for authorization requests"),
  authorizationError: (description: string) =>
    new OidcError("AUTHORIZATION_ERROR", description),
  missingAuthCode: () =>
    new OidcError("MISSING_AUTH_CODE", "No authorization code in callback URL"),
  stateMismatch: () =>
    new OidcError("STATE_MISMATCH", "State parameter does not match — possible CSRF attack"),
  missingClientSecret: () =>
    new OidcError("MISSING_CLIENT_SECRET", "clientSecret is required for token introspection"),
  tokenResponseNotObject: () =>
    new OidcError("TOKEN_EXCHANGE_ERROR", "Token response must be a JSON object"),
  tokenExchangeError: (description: string) =>
    new OidcError("TOKEN_EXCHANGE_ERROR", description),
  missingAccessToken: () =>
    new OidcError("TOKEN_EXCHANGE_ERROR", "Missing access_token in token response"),
  nonceMismatch: () =>
    new OidcError("NONCE_MISMATCH", "Nonce in ID token does not match the expected value"),
  invalidJwtParts: () =>
    new OidcError("INVALID_JWT", "JWT must have 3 parts separated by dots"),
  invalidJwtDecode: () =>
    new OidcError("INVALID_JWT", "Failed to decode JWT payload"),
  invalidBase64url: () =>
    new OidcError("INVALID_JWT", "Invalid base64url input"),
  userinfoNotObject: () =>
    new OidcError("USERINFO_ERROR", "UserInfo response must be a JSON object"),
  userinfoMissingSub: () =>
    new OidcError("USERINFO_ERROR", "Missing or invalid 'sub' claim in UserInfo response"),
  introspectionNotObject: () =>
    new OidcError("INTROSPECTION_ERROR", "Introspection response must be a JSON object"),
  introspectionMissingActive: () =>
    new OidcError("INTROSPECTION_ERROR", "Missing or invalid 'active' field in introspection response"),
};
