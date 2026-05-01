import { describe, it, expect } from "vitest";
import { buildUserinfoRequest, parseUserinfoResponse } from "../userinfo.js";
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
});
