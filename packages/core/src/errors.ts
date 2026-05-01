/**
 * Union of all typed error codes thrown by oidc-js-core.
 *
 * Each code maps to a specific validation or protocol failure defined in
 * RFC 6749, RFC 7636, or OpenID Connect Core 1.0.
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
  | "MISSING_CLIENT_SECRET";

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
