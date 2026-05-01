import type { OidcDiscovery } from "./types.js";
import { OidcError } from "./errors.js";

/**
 * Constructs the well-known OpenID Provider Configuration URL for the given issuer.
 *
 * Trailing slashes on the issuer are stripped before appending the well-known path.
 *
 * @param issuer - The OpenID Provider issuer identifier (e.g. `https://accounts.example.com`).
 * @returns The full `/.well-known/openid-configuration` URL.
 *
 * @see OpenID Connect Discovery 1.0 §4.1 -- OpenID Provider Configuration Request
 */
// OIDC Discovery §4.1: OpenID Provider Configuration Request
export function buildDiscoveryUrl(issuer: string): string {
  return `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
}

const REQUIRED_STRING_FIELDS: (keyof OidcDiscovery)[] = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
];

const REQUIRED_ARRAY_FIELDS: (keyof OidcDiscovery)[] = [
  "response_types_supported",
  "subject_types_supported",
  "id_token_signing_alg_values_supported",
];

/**
 * Validates and parses a raw OpenID Provider Configuration response into an {@link OidcDiscovery} object.
 *
 * Checks that all required string and array fields are present, and that the returned issuer
 * exactly matches `expectedIssuer` (after trailing-slash normalization).
 *
 * @param data - The raw JSON-parsed discovery response body.
 * @param expectedIssuer - The issuer identifier the caller originally requested.
 * @returns A validated {@link OidcDiscovery} object.
 * @throws {OidcError} `DISCOVERY_INVALID` if required fields are missing or the response is not an object.
 * @throws {OidcError} `DISCOVERY_ISSUER_MISMATCH` if the returned issuer does not match `expectedIssuer`.
 *
 * @see OpenID Connect Discovery 1.0 §4.3 -- OpenID Provider Configuration Response
 */
// OIDC Discovery §4.3: OpenID Provider Configuration Response
export function parseDiscoveryResponse(data: unknown, expectedIssuer: string): OidcDiscovery {
  if (!data || typeof data !== "object") {
    throw new OidcError("DISCOVERY_INVALID", "Discovery response must be a JSON object");
  }

  const doc = data as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof doc[field] !== "string") {
      throw new OidcError("DISCOVERY_INVALID", `Missing or invalid required field: ${field}`);
    }
  }

  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(doc[field])) {
      throw new OidcError("DISCOVERY_INVALID", `Missing or invalid required field: ${field}`);
    }
  }

  // OIDC Discovery §4.3: issuer in the response MUST exactly match the issuer URL
  const normalizedExpected = expectedIssuer.replace(/\/+$/, "");
  const normalizedActual = (doc.issuer as string).replace(/\/+$/, "");
  if (normalizedActual !== normalizedExpected) {
    throw new OidcError(
      "DISCOVERY_ISSUER_MISMATCH",
      `Expected issuer ${normalizedExpected}, got ${normalizedActual}`,
    );
  }

  return data as OidcDiscovery;
}
