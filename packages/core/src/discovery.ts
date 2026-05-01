import type { OidcDiscovery } from "./types.js";
import { OidcError } from "./errors.js";

// OIDC Discovery §4.1: OpenID Provider Configuration Request
export function buildDiscoveryUrl(issuer: string): string {
  return `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
}

const REQUIRED_FIELDS: (keyof OidcDiscovery)[] = [
  "issuer",
  "authorization_endpoint",
  "token_endpoint",
  "jwks_uri",
  "response_types_supported",
  "subject_types_supported",
  "id_token_signing_alg_values_supported",
];

// OIDC Discovery §4.3: OpenID Provider Configuration Response
export function parseDiscoveryResponse(data: unknown, expectedIssuer: string): OidcDiscovery {
  if (!data || typeof data !== "object") {
    throw new OidcError("DISCOVERY_INVALID", "Discovery response must be a JSON object");
  }

  const doc = data as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (doc[field] === undefined || doc[field] === null) {
      throw new OidcError("DISCOVERY_INVALID", `Missing required field: ${field}`);
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
