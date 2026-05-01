import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeExpiresAt, isTokenExpired, timeUntilExpiry } from "../token-utils.js";
import type { TokenSet } from "../types.js";

describe("computeExpiresAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns absolute timestamp from relative expires_in", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = computeExpiresAt(3600);

    expect(result).toBe(now + 3600);
  });
});

describe("isTokenExpired", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for future expiry", () => {
    const tokenSet: TokenSet = {
      access_token: "at",
      token_type: "Bearer",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };

    expect(isTokenExpired(tokenSet)).toBe(false);
  });

  it("returns true for past expiry", () => {
    const tokenSet: TokenSet = {
      access_token: "at",
      token_type: "Bearer",
      expires_at: Math.floor(Date.now() / 1000) - 60,
    };

    expect(isTokenExpired(tokenSet)).toBe(true);
  });

  it("returns false when expires_at is undefined", () => {
    const tokenSet: TokenSet = {
      access_token: "at",
      token_type: "Bearer",
    };

    expect(isTokenExpired(tokenSet)).toBe(false);
  });

  it("accounts for clockSkewSeconds", () => {
    const now = Math.floor(Date.now() / 1000);
    const tokenSet: TokenSet = {
      access_token: "at",
      token_type: "Bearer",
      expires_at: now + 30,
    };

    expect(isTokenExpired(tokenSet, 0)).toBe(false);
    expect(isTokenExpired(tokenSet, 60)).toBe(true);
  });
});

describe("timeUntilExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns positive seconds for valid token", () => {
    const tokenSet: TokenSet = {
      access_token: "at",
      token_type: "Bearer",
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    };

    expect(timeUntilExpiry(tokenSet)).toBe(1800);
  });

  it("returns 0 for expired token", () => {
    const tokenSet: TokenSet = {
      access_token: "at",
      token_type: "Bearer",
      expires_at: Math.floor(Date.now() / 1000) - 300,
    };

    expect(timeUntilExpiry(tokenSet)).toBe(0);
  });

  it("returns Infinity when expires_at is undefined", () => {
    const tokenSet: TokenSet = {
      access_token: "at",
      token_type: "Bearer",
    };

    expect(timeUntilExpiry(tokenSet)).toBe(Infinity);
  });
});
