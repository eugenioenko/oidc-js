import { describe, it, expect } from "vitest";
import { buildUserinfoRequest, parseUserinfoResponse } from "../userinfo.js";
import { OidcError } from "../errors.js";
import type { OidcDiscovery } from "../types.js";

const DISCOVERY: OidcDiscovery = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/authorize",
  token_endpoint: "https://auth.example.com/token",
  userinfo_endpoint: "https://auth.example.com/userinfo",
  jwks_uri: "https://auth.example.com/.well-known/jwks.json",
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
};

describe("buildUserinfoRequest", () => {
  // RFC 6750 §2.1: Bearer token in Authorization header
  it("RFC 6750 §2.1: sets Authorization Bearer header", () => {
    const req = buildUserinfoRequest(DISCOVERY, "at_123");

    expect(req.headers["Authorization"]).toBe("Bearer at_123");
  });

  // OIDC Core §5.3.1: UserInfo Request
  it("OIDC Core §5.3.1: uses GET method", () => {
    const req = buildUserinfoRequest(DISCOVERY, "at_123");

    expect(req.method).toBe("GET");
    expect(req.url).toBe("https://auth.example.com/userinfo");
  });

  it("does not include a body on GET request", () => {
    const req = buildUserinfoRequest(DISCOVERY, "at_123");

    expect(req.body).toBeUndefined();
  });
});

describe("parseUserinfoResponse", () => {
  // OIDC Core §5.3.2: UserInfo Response
  it("OIDC Core §5.3.2: extracts standard claims", () => {
    const data = {
      sub: "user-123",
      email: "user@example.com",
      name: "Test User",
      preferred_username: "testuser",
    };

    const user = parseUserinfoResponse(data);

    expect(user.sub).toBe("user-123");
    expect(user.email).toBe("user@example.com");
    expect(user.name).toBe("Test User");
    expect(user.preferred_username).toBe("testuser");
  });

  it("preserves custom claims", () => {
    const data = {
      sub: "user-123",
      custom_claim: "custom_value",
      groups: ["admin", "users"],
    };

    const user = parseUserinfoResponse(data);

    expect(user.custom_claim).toBe("custom_value");
    expect(user.groups).toEqual(["admin", "users"]);
  });

  it("throws TOKEN_EXCHANGE_ERROR on non-object input", () => {
    expect(() => parseUserinfoResponse(null)).toThrow(OidcError);
    expect(() => parseUserinfoResponse("string")).toThrow(OidcError);
    expect(() => parseUserinfoResponse(42)).toThrow(OidcError);
  });

  // OIDC Core §5.3.2: sub claim is REQUIRED
  it("OIDC Core §5.3.2: throws TOKEN_EXCHANGE_ERROR when sub claim is missing", () => {
    try {
      parseUserinfoResponse({ email: "user@example.com" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
    }
  });

  it("throws TOKEN_EXCHANGE_ERROR when sub claim is not a string", () => {
    try {
      parseUserinfoResponse({ sub: 123, email: "user@example.com" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
    }
  });
});
