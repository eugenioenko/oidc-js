import { describe, it, expect } from "vitest";
import { buildDiscoveryUrl, parseDiscoveryResponse } from "../discovery.js";
import { OidcError } from "../errors.js";

const VALID_DISCOVERY = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/authorize",
  token_endpoint: "https://auth.example.com/token",
  userinfo_endpoint: "https://auth.example.com/userinfo",
  jwks_uri: "https://auth.example.com/.well-known/jwks.json",
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
};

describe("buildDiscoveryUrl", () => {
  // OIDC Discovery §4.1: well-known URI
  it("OIDC Discovery §4.1: appends /.well-known/openid-configuration", () => {
    expect(buildDiscoveryUrl("https://auth.example.com")).toBe(
      "https://auth.example.com/.well-known/openid-configuration",
    );
  });

  it("strips trailing slash from issuer", () => {
    expect(buildDiscoveryUrl("https://auth.example.com/")).toBe(
      "https://auth.example.com/.well-known/openid-configuration",
    );
  });
});

describe("parseDiscoveryResponse", () => {
  // OIDC Discovery §4.3: issuer MUST exactly match
  it("OIDC Discovery §4.3: accepts valid discovery document", () => {
    const result = parseDiscoveryResponse(VALID_DISCOVERY, "https://auth.example.com");
    expect(result.issuer).toBe("https://auth.example.com");
    expect(result.authorization_endpoint).toBe("https://auth.example.com/authorize");
  });

  // OIDC Discovery §4.3: issuer mismatch
  it("OIDC Discovery §4.3: throws DISCOVERY_ISSUER_MISMATCH when issuer differs", () => {
    expect(() =>
      parseDiscoveryResponse(VALID_DISCOVERY, "https://other.example.com"),
    ).toThrow(OidcError);

    try {
      parseDiscoveryResponse(VALID_DISCOVERY, "https://other.example.com");
    } catch (e) {
      expect((e as OidcError).code).toBe("DISCOVERY_ISSUER_MISMATCH");
    }
  });

  it("throws DISCOVERY_INVALID when required fields are missing", () => {
    const incomplete = { issuer: "https://auth.example.com" };
    expect(() =>
      parseDiscoveryResponse(incomplete, "https://auth.example.com"),
    ).toThrow(OidcError);

    try {
      parseDiscoveryResponse(incomplete, "https://auth.example.com");
    } catch (e) {
      expect((e as OidcError).code).toBe("DISCOVERY_INVALID");
    }
  });

  it("throws DISCOVERY_INVALID on non-object input", () => {
    expect(() => parseDiscoveryResponse(null, "https://auth.example.com")).toThrow(OidcError);
    expect(() => parseDiscoveryResponse("string", "https://auth.example.com")).toThrow(OidcError);
    expect(() => parseDiscoveryResponse(42, "https://auth.example.com")).toThrow(OidcError);
  });

  it("normalizes trailing slashes when comparing issuers", () => {
    const result = parseDiscoveryResponse(VALID_DISCOVERY, "https://auth.example.com/");
    expect(result.issuer).toBe("https://auth.example.com");
  });
});
