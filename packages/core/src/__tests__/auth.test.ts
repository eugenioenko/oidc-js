import { describe, it, expect } from "vitest";
import { buildClientAuthHeaders } from "../auth.js";
import type { OidcConfig } from "../types.js";

describe("buildClientAuthHeaders", () => {
  // RFC 6749 §2.3.1: HTTP Basic authentication for confidential clients
  it("RFC 6749 §2.3.1: returns Basic auth header for confidential client", () => {
    const config: OidcConfig = {
      issuer: "https://auth.example.com",
      clientId: "my-app",
      clientSecret: "my-secret",
    };

    const headers = buildClientAuthHeaders(config);
    const expected = btoa("my-app:my-secret");

    expect(headers["Authorization"]).toBe(`Basic ${expected}`);
  });

  it("returns empty object for public client", () => {
    const config: OidcConfig = {
      issuer: "https://auth.example.com",
      clientId: "my-app",
    };

    const headers = buildClientAuthHeaders(config);

    expect(headers).toEqual({});
  });
});
