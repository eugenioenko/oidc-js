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

export class OidcError extends Error {
  constructor(
    public readonly code: OidcErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OidcError";
  }
}
