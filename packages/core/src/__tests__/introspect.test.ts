import { describe, it, expect } from "vitest";
import { buildIntrospectRequest, parseIntrospectResponse } from "../introspect.js";
import { OidcError } from "../errors.js";
import type { OidcDiscovery, OidcConfig } from "../types.js";

const DISCOVERY: OidcDiscovery = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/authorize",
  token_endpoint: "https://auth.example.com/token",
  userinfo_endpoint: "https://auth.example.com/userinfo",
  jwks_uri: "https://auth.example.com/.well-known/jwks.json",
  introspection_endpoint: "https://auth.example.com/introspect",
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
};

const DISCOVERY_NO_INTROSPECT: OidcDiscovery = {
  ...DISCOVERY,
  introspection_endpoint: undefined,
};

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-api",
  clientSecret: "api-secret",
};

describe("buildIntrospectRequest", () => {
  // RFC 7662 §2.1: Introspection Request
  it("RFC 7662 §2.1: includes token parameter", () => {
    const req = buildIntrospectRequest(DISCOVERY, CONFIG, "at_xyz");
    expect(req).not.toBeNull();
    const params = new URLSearchParams(req!.body);

    expect(params.get("token")).toBe("at_xyz");
    expect(req!.method).toBe("POST");
    expect(req!.url).toBe("https://auth.example.com/introspect");
  });

  // RFC 7662 §2.1: protected resource MUST authenticate
  it("RFC 7662 §2.1: adds Basic auth header", () => {
    const req = buildIntrospectRequest(DISCOVERY, CONFIG, "at_xyz");
    expect(req).not.toBeNull();
    const expected = btoa("my-api:api-secret");

    expect(req!.headers["Authorization"]).toBe(`Basic ${expected}`);
    expect(req!.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("throws MISSING_CLIENT_SECRET without clientSecret", () => {
    const publicConfig: OidcConfig = {
      issuer: "https://auth.example.com",
      clientId: "my-app",
    };

    try {
      buildIntrospectRequest(DISCOVERY, publicConfig, "at_xyz");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("MISSING_CLIENT_SECRET");
    }
  });

  it("returns null when no introspection_endpoint", () => {
    const req = buildIntrospectRequest(DISCOVERY_NO_INTROSPECT, CONFIG, "at_xyz");
    expect(req).toBeNull();
  });
});

describe("parseIntrospectResponse", () => {
  // RFC 7662 §2.2: Introspection Response
  it("RFC 7662 §2.2: parses active=true with metadata", () => {
    const data = {
      active: true,
      scope: "openid profile",
      client_id: "my-app",
      username: "testuser",
      token_type: "Bearer",
      exp: 1735689600,
      sub: "user-123",
    };

    const result = parseIntrospectResponse(data);

    expect(result.active).toBe(true);
    expect(result.scope).toBe("openid profile");
    expect(result.sub).toBe("user-123");
    expect(result.exp).toBe(1735689600);
  });

  // RFC 7662 §2.2: inactive token
  it("RFC 7662 §2.2: parses active=false", () => {
    const result = parseIntrospectResponse({ active: false });

    expect(result.active).toBe(false);
  });

  it("throws TOKEN_EXCHANGE_ERROR on non-object input", () => {
    expect(() => parseIntrospectResponse(null)).toThrow(OidcError);
    expect(() => parseIntrospectResponse("string")).toThrow(OidcError);
    expect(() => parseIntrospectResponse(42)).toThrow(OidcError);
  });

  it("throws TOKEN_EXCHANGE_ERROR when active field is missing", () => {
    try {
      parseIntrospectResponse({ scope: "openid" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
    }
  });

  it("throws TOKEN_EXCHANGE_ERROR when active field is not boolean", () => {
    try {
      parseIntrospectResponse({ active: "true" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
    }
  });
});
