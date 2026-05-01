import { describe, it, expect } from "vitest";
import { decodeJwtPayload, parseIdTokenClaims } from "../jwt.js";
import { OidcError } from "../errors.js";

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("decodeJwtPayload", () => {
  it("decodes a valid 3-part JWT", () => {
    const jwt = makeJwt({ sub: "user-123", email: "test@example.com" });
    const claims = decodeJwtPayload(jwt);

    expect(claims.sub).toBe("user-123");
    expect(claims.email).toBe("test@example.com");
  });

  it("handles base64url padding correctly", () => {
    // Payload with characters that need URL-safe encoding
    const payload = { sub: "user+special/chars==" };
    const header = btoa(JSON.stringify({ alg: "RS256" }));
    const body = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const jwt = `${header}.${body}.sig`;

    const claims = decodeJwtPayload(jwt);
    expect(claims.sub).toBe("user+special/chars==");
  });

  it("throws INVALID_JWT on non-3-part string", () => {
    try {
      decodeJwtPayload("not.a.valid.jwt.token");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("INVALID_JWT");
    }

    expect(() => decodeJwtPayload("single-part")).toThrow(OidcError);
    expect(() => decodeJwtPayload("two.parts")).toThrow(OidcError);
  });

  it("throws INVALID_JWT on malformed base64", () => {
    try {
      decodeJwtPayload("header.!!!invalid!!!.sig");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(OidcError);
      expect((e as OidcError).code).toBe("INVALID_JWT");
    }
  });
});

describe("parseIdTokenClaims", () => {
  // OIDC Core §2: ID Token claims
  it("OIDC Core §2: extracts sub, email, name, preferred_username", () => {
    const jwt = makeJwt({
      sub: "user-456",
      email: "user@example.com",
      name: "Test User",
      preferred_username: "testuser",
    });

    const user = parseIdTokenClaims(jwt);

    expect(user.sub).toBe("user-456");
    expect(user.email).toBe("user@example.com");
    expect(user.name).toBe("Test User");
    expect(user.preferred_username).toBe("testuser");
  });
});
