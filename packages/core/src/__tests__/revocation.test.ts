import { describe, it, expect } from "vitest";
import { buildRevocationRequest } from "../revocation.js";
import type { OidcDiscovery, OidcConfig } from "../types.js";

const DISCOVERY: OidcDiscovery = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/authorize",
  token_endpoint: "https://auth.example.com/token",
  userinfo_endpoint: "https://auth.example.com/userinfo",
  jwks_uri: "https://auth.example.com/.well-known/jwks.json",
  revocation_endpoint: "https://auth.example.com/revoke",
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
};

const DISCOVERY_NO_REVOCATION: OidcDiscovery = {
  ...DISCOVERY,
  revocation_endpoint: undefined,
};

const PUBLIC_CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
};

const CONFIDENTIAL_CONFIG: OidcConfig = {
  ...PUBLIC_CONFIG,
  clientSecret: "my-secret",
};

describe("buildRevocationRequest", () => {
  // RFC 7009 §2.1: Token Revocation Request
  it("RFC 7009 §2.1: includes token parameter", () => {
    const req = buildRevocationRequest(DISCOVERY, PUBLIC_CONFIG, "at_123");

    expect(req).not.toBeNull();
    const params = new URLSearchParams(req!.body);
    expect(params.get("token")).toBe("at_123");
    expect(req!.method).toBe("POST");
    expect(req!.url).toBe("https://auth.example.com/revoke");
  });

  // RFC 7009 §2.1: token_type_hint is OPTIONAL
  it("RFC 7009 §2.1: includes token_type_hint when provided", () => {
    const req = buildRevocationRequest(DISCOVERY, PUBLIC_CONFIG, "rt_123", "refresh_token");
    const params = new URLSearchParams(req!.body);

    expect(params.get("token_type_hint")).toBe("refresh_token");
  });

  it("omits token_type_hint when not provided", () => {
    const req = buildRevocationRequest(DISCOVERY, PUBLIC_CONFIG, "at_123");
    const params = new URLSearchParams(req!.body);

    expect(params.has("token_type_hint")).toBe(false);
  });

  it("returns null when no revocation_endpoint", () => {
    const req = buildRevocationRequest(DISCOVERY_NO_REVOCATION, PUBLIC_CONFIG, "at_123");

    expect(req).toBeNull();
  });

  // RFC 6749 §2.3.1: confidential clients authenticate
  it("RFC 6749 §2.3.1: adds Basic auth for confidential client", () => {
    const req = buildRevocationRequest(DISCOVERY, CONFIDENTIAL_CONFIG, "at_123");
    const expected = btoa("my-app:my-secret");

    expect(req!.headers["Authorization"]).toBe(`Basic ${expected}`);
  });

  it("omits Authorization header for public client", () => {
    const req = buildRevocationRequest(DISCOVERY, PUBLIC_CONFIG, "at_123");

    expect(req!.headers["Authorization"]).toBeUndefined();
  });
});
