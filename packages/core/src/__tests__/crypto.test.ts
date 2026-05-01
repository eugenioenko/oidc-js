import { describe, it, expect } from "vitest";
import {
  generateRandom,
  generatePkce,
  computeCodeChallenge,
  generateState,
  generateNonce,
  base64UrlEncode,
  base64UrlDecode,
} from "../crypto.js";

describe("base64UrlEncode / base64UrlDecode", () => {
  it("roundtrip preserves data", () => {
    const original = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const encoded = base64UrlEncode(original);
    const decoded = base64UrlDecode(encoded);
    expect(decoded).toEqual(original);
  });

  it("produces URL-safe output without padding", () => {
    const bytes = new Uint8Array([251, 239, 190]);
    const encoded = base64UrlEncode(bytes);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });
});

describe("generateRandom", () => {
  it("produces a string of expected length", () => {
    const result = generateRandom(32);
    expect(result.length).toBe(32);
  });

  // RFC 7636 §4.1: unreserved characters only
  it("RFC 7636 §4.1: uses only unreserved characters", () => {
    const result = generateRandom(128);
    expect(result).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it("produces unique values on consecutive calls", () => {
    const a = generateRandom();
    const b = generateRandom();
    expect(a).not.toBe(b);
  });
});

describe("generatePkce", () => {
  // RFC 7636 §4.1: code_verifier = 43-128 unreserved characters
  it("RFC 7636 §4.1: verifier is at least 43 characters of unreserved chars", async () => {
    const { verifier } = await generatePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  // RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(code_verifier))
  it("RFC 7636 §4.2: challenge matches SHA-256 of verifier", async () => {
    const { verifier, challenge } = await generatePkce();
    const recomputed = await computeCodeChallenge(verifier);
    expect(challenge).toBe(recomputed);
  });
});

describe("computeCodeChallenge", () => {
  // RFC 7636 §4.2 Appendix B: test vector
  it("RFC 7636 §4.2: produces correct S256 challenge", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await computeCodeChallenge(verifier);
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("generateState", () => {
  // RFC 6749 §10.12: state for CSRF protection
  it("RFC 6749 §10.12: produces unique values", () => {
    const a = generateState();
    const b = generateState();
    expect(a).not.toBe(b);
  });
});

describe("generateNonce", () => {
  // OIDC Core §3.1.2.1: nonce binds client session to ID token
  it("OIDC Core §3.1.2.1: produces unique values", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});
