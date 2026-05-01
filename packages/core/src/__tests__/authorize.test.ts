import { describe, it, expect } from "vitest";
import { buildAuthUrl, parseCallbackUrl } from "../authorize.js";
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

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

const PKCE = { verifier: "test-verifier", challenge: "test-challenge" };

describe("buildAuthUrl", () => {
  // RFC 6749 §4.1.1: Authorization Request
  it("RFC 6749 §4.1.1: includes all required authorization parameters", () => {
    const url = buildAuthUrl(DISCOVERY, CONFIG, PKCE, "state123", "nonce456");
    const params = new URL(url).searchParams;

    expect(params.get("response_type")).toBe("code");
    expect(params.get("client_id")).toBe("my-app");
    expect(params.get("redirect_uri")).toBe("http://localhost:3000/callback");
    expect(params.get("state")).toBe("state123");
  });

  // RFC 7636 §4.3: code_challenge and code_challenge_method
  it("RFC 7636 §4.3: includes PKCE code_challenge with S256 method", () => {
    const url = buildAuthUrl(DISCOVERY, CONFIG, PKCE, "state", "nonce");
    const params = new URL(url).searchParams;

    expect(params.get("code_challenge")).toBe("test-challenge");
    expect(params.get("code_challenge_method")).toBe("S256");
  });

  // OIDC Core §3.1.2.1: nonce
  it("OIDC Core §3.1.2.1: includes nonce parameter", () => {
    const url = buildAuthUrl(DISCOVERY, CONFIG, PKCE, "state", "nonce789");
    const params = new URL(url).searchParams;

    expect(params.get("nonce")).toBe("nonce789");
  });

  it("uses default scopes when none specified", () => {
    const url = buildAuthUrl(DISCOVERY, CONFIG, PKCE, "s", "n");
    const params = new URL(url).searchParams;

    expect(params.get("scope")).toBe("openid profile email");
  });

  it("uses custom scopes when specified", () => {
    const config = { ...CONFIG, scopes: ["openid", "offline_access"] };
    const url = buildAuthUrl(DISCOVERY, config, PKCE, "s", "n");
    const params = new URL(url).searchParams;

    expect(params.get("scope")).toBe("openid offline_access");
  });

  it("merges extraParams", () => {
    const url = buildAuthUrl(DISCOVERY, CONFIG, PKCE, "s", "n", { prompt: "login" });
    const params = new URL(url).searchParams;

    expect(params.get("prompt")).toBe("login");
  });

  it("throws MISSING_REDIRECT_URI when redirectUri is not set", () => {
    const config: OidcConfig = { issuer: "https://auth.example.com", clientId: "my-app" };

    try {
      buildAuthUrl(DISCOVERY, config, PKCE, "s", "n");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("MISSING_REDIRECT_URI");
    }
  });
});

describe("parseCallbackUrl", () => {
  // RFC 6749 §4.1.2: Authorization Response
  it("RFC 6749 §4.1.2: extracts code and state from callback URL", () => {
    const url = "http://localhost:3000/callback?code=abc123&state=expected-state";
    const result = parseCallbackUrl(url, "expected-state");

    expect(result.code).toBe("abc123");
    expect(result.state).toBe("expected-state");
  });

  // RFC 6749 §10.12: state MUST match
  it("RFC 6749 §10.12: throws STATE_MISMATCH when state does not match", () => {
    const url = "http://localhost:3000/callback?code=abc&state=wrong";

    try {
      parseCallbackUrl(url, "expected");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("STATE_MISMATCH");
    }
  });

  // RFC 6749 §4.1.2.1: Error Response
  it("RFC 6749 §4.1.2.1: throws AUTHORIZATION_ERROR on error response", () => {
    const url = "http://localhost:3000/callback?error=access_denied&error_description=User+denied";

    try {
      parseCallbackUrl(url, "state");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("AUTHORIZATION_ERROR");
      expect((e as OidcError).message).toBe("User denied");
    }
  });

  it("throws AUTHORIZATION_ERROR using error code when no description", () => {
    const url = "http://localhost:3000/callback?error=server_error";

    try {
      parseCallbackUrl(url, "state");
      expect.fail("should have thrown");
    } catch (e) {
      expect((e as OidcError).message).toBe("server_error");
    }
  });

  it("throws MISSING_AUTH_CODE when code is absent", () => {
    const url = "http://localhost:3000/callback?state=expected";

    try {
      parseCallbackUrl(url, "expected");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("MISSING_AUTH_CODE");
    }
  });
});
