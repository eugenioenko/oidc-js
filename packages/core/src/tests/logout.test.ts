import { describe, it, expect } from "vitest";
import { buildLogoutUrl } from "../logout.js";
import type { OidcDiscovery } from "../types.js";

const DISCOVERY: OidcDiscovery = {
  issuer: "https://auth.example.com",
  authorization_endpoint: "https://auth.example.com/authorize",
  token_endpoint: "https://auth.example.com/token",
  userinfo_endpoint: "https://auth.example.com/userinfo",
  jwks_uri: "https://auth.example.com/.well-known/jwks.json",
  end_session_endpoint: "https://auth.example.com/logout",
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
};

const DISCOVERY_NO_LOGOUT: OidcDiscovery = {
  ...DISCOVERY,
  end_session_endpoint: undefined,
};

describe("buildLogoutUrl", () => {
  // OIDC RP-Initiated Logout §2: id_token_hint
  it("OIDC RP-Initiated Logout §2: includes id_token_hint", () => {
    const url = buildLogoutUrl(DISCOVERY, "id-token-value");

    expect(url).not.toBeNull();
    const params = new URL(url!).searchParams;
    expect(params.get("id_token_hint")).toBe("id-token-value");
  });

  // OIDC RP-Initiated Logout §2: post_logout_redirect_uri
  it("includes post_logout_redirect_uri", () => {
    const url = buildLogoutUrl(DISCOVERY, "id-token", "http://localhost:3000");
    const params = new URL(url!).searchParams;

    expect(params.get("post_logout_redirect_uri")).toBe("http://localhost:3000");
  });

  it("returns null when no end_session_endpoint", () => {
    const url = buildLogoutUrl(DISCOVERY_NO_LOGOUT, "id-token");

    expect(url).toBeNull();
  });

  it("works without id_token", () => {
    const url = buildLogoutUrl(DISCOVERY, undefined, "http://localhost:3000");

    expect(url).not.toBeNull();
    const params = new URL(url!).searchParams;
    expect(params.has("id_token_hint")).toBe(false);
    expect(params.get("post_logout_redirect_uri")).toBe("http://localhost:3000");
  });

  it("returns bare endpoint when no params provided", () => {
    const url = buildLogoutUrl(DISCOVERY);

    expect(url).toBe("https://auth.example.com/logout");
  });
});
