import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildTokenRequest, buildRefreshRequest, parseTokenResponse } from "../token.js";
import { nowSeconds } from "../token-utils.js";
import { OidcError } from "../errors.js";
import type { OidcDiscovery, OidcConfig } from "../types.js";

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

const PUBLIC_CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

const CONFIDENTIAL_CONFIG: OidcConfig = {
  ...PUBLIC_CONFIG,
  clientSecret: "my-secret",
};

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("buildTokenRequest", () => {
  // RFC 6749 §4.1.3: Access Token Request
  it("RFC 6749 §4.1.3: uses grant_type=authorization_code", () => {
    const req = buildTokenRequest(DISCOVERY, PUBLIC_CONFIG, "code123", "verifier456");
    const params = new URLSearchParams(req.body);

    expect(params.get("grant_type")).toBe("authorization_code");
    expect(params.get("code")).toBe("code123");
  });

  // RFC 7636 §4.5: code_verifier MUST be sent
  it("RFC 7636 §4.5: includes code_verifier", () => {
    const req = buildTokenRequest(DISCOVERY, PUBLIC_CONFIG, "code", "verifier");
    const params = new URLSearchParams(req.body);

    expect(params.get("code_verifier")).toBe("verifier");
  });

  // RFC 6749 §4.1.3: request uses application/x-www-form-urlencoded
  it("RFC 6749 §4.1.3: uses application/x-www-form-urlencoded", () => {
    const req = buildTokenRequest(DISCOVERY, PUBLIC_CONFIG, "code", "verifier");

    expect(req.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://auth.example.com/token");
  });

  it("includes redirect_uri when set", () => {
    const req = buildTokenRequest(DISCOVERY, PUBLIC_CONFIG, "code", "verifier");
    const params = new URLSearchParams(req.body);

    expect(params.get("redirect_uri")).toBe("http://localhost:3000/callback");
  });

  // RFC 6749 §2.3.1: HTTP Basic authentication for confidential clients
  it("RFC 6749 §2.3.1: adds Basic auth header for confidential client", () => {
    const req = buildTokenRequest(DISCOVERY, CONFIDENTIAL_CONFIG, "code", "verifier");
    const expected = btoa("my-app:my-secret");

    expect(req.headers["Authorization"]).toBe(`Basic ${expected}`);
  });

  it("omits Authorization header for public client", () => {
    const req = buildTokenRequest(DISCOVERY, PUBLIC_CONFIG, "code", "verifier");

    expect(req.headers["Authorization"]).toBeUndefined();
  });
});

describe("buildRefreshRequest", () => {
  // RFC 6749 §6: Refreshing an Access Token
  it("RFC 6749 §6: uses grant_type=refresh_token", () => {
    const req = buildRefreshRequest(DISCOVERY, PUBLIC_CONFIG, "rt_abc");
    const params = new URLSearchParams(req.body);

    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("rt_abc");
    expect(params.get("client_id")).toBe("my-app");
  });

  it("includes Basic auth for confidential client", () => {
    const req = buildRefreshRequest(DISCOVERY, CONFIDENTIAL_CONFIG, "rt_abc");
    const expected = btoa("my-app:my-secret");

    expect(req.headers["Authorization"]).toBe(`Basic ${expected}`);
  });
});

describe("parseTokenResponse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // RFC 6749 §5.1: Successful Response
  it("RFC 6749 §5.1: returns TokenSet with computed expires_at", () => {
    const data = {
      access_token: "at_123",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "rt_123",
      scope: "openid profile",
    };

    const result = parseTokenResponse(data);

    expect(result.access_token).toBe("at_123");
    expect(result.token_type).toBe("Bearer");
    expect(result.expires_in).toBe(3600);
    expect(result.refresh_token).toBe("rt_123");
    expect(result.expires_at).toBe(nowSeconds() + 3600);
  });

  it("defaults token_type to Bearer when missing", () => {
    const result = parseTokenResponse({ access_token: "at" });
    expect(result.token_type).toBe("Bearer");
  });

  it("omits expires_at when expires_in is not present", () => {
    const result = parseTokenResponse({ access_token: "at", token_type: "Bearer" });
    expect(result.expires_at).toBeUndefined();
  });

  // OIDC Core §3.1.3.7: nonce in ID token MUST match
  it("OIDC Core §3.1.3.7: throws NONCE_MISMATCH when ID token nonce differs", () => {
    const idToken = makeJwt({ sub: "user1", nonce: "wrong-nonce" });
    const data = { access_token: "at", token_type: "Bearer", id_token: idToken };

    try {
      parseTokenResponse(data, "expected-nonce");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("NONCE_MISMATCH");
    }
  });

  it("accepts matching nonce in ID token", () => {
    const idToken = makeJwt({ sub: "user1", nonce: "correct-nonce" });
    const data = { access_token: "at", token_type: "Bearer", id_token: idToken };

    const result = parseTokenResponse(data, "correct-nonce");
    expect(result.access_token).toBe("at");
  });

  it("skips nonce check when expectedNonce is not provided", () => {
    const idToken = makeJwt({ sub: "user1", nonce: "any" });
    const data = { access_token: "at", token_type: "Bearer", id_token: idToken };

    const result = parseTokenResponse(data);
    expect(result.access_token).toBe("at");
  });

  it("throws TOKEN_EXCHANGE_ERROR on missing access_token", () => {
    try {
      parseTokenResponse({ token_type: "Bearer" });
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("TOKEN_EXCHANGE_ERROR");
    }
  });

  it("throws TOKEN_EXCHANGE_ERROR on non-object input", () => {
    expect(() => parseTokenResponse(null)).toThrow(OidcError);
    expect(() => parseTokenResponse("string")).toThrow(OidcError);
  });
});
