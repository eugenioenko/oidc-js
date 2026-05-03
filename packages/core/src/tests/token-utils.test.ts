import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nowSeconds, computeExpiresAt, timeUntilExpiry, isExpiredAt, DEFAULT_TOKEN_EXPIRATION_BUFFER } from "../token-utils.js";

describe("computeExpiresAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns absolute timestamp from relative expires_in", () => {
    const result = computeExpiresAt(3600);
    expect(result).toBe(nowSeconds() + 3600);
  });
});

describe("isExpiredAt", () => {

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when expiresAt is null", () => {
    expect(isExpiredAt(null)).toBe(false);
  });

  it("returns false for future expiry beyond buffer", () => {
    expect(isExpiredAt(nowSeconds() + 60)).toBe(false);
  });

  it("returns true for past expiry", () => {
    expect(isExpiredAt(nowSeconds() - 1)).toBe(true);
  });

  it("returns true when within default buffer window", () => {
    expect(isExpiredAt(nowSeconds() + 15)).toBe(true);
  });

  it("uses custom buffer", () => {
    const expiresAt = nowSeconds() + 5;
    expect(isExpiredAt(expiresAt, 10)).toBe(true);
    expect(isExpiredAt(expiresAt, 2)).toBe(false);
  });

  it("returns false at exact boundary with zero buffer", () => {
    expect(isExpiredAt(nowSeconds() + 1, 0)).toBe(false);
  });

  it("defaults to DEFAULT_TOKEN_EXPIRATION_BUFFER (30s)", () => {
    expect(DEFAULT_TOKEN_EXPIRATION_BUFFER).toBe(30);
    expect(isExpiredAt(nowSeconds() + 29)).toBe(true);
    expect(isExpiredAt(nowSeconds() + 31)).toBe(false);
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
    expect(timeUntilExpiry(nowSeconds() + 60)).toBe(60);
  });

  it("returns 0 for expired token", () => {
    expect(timeUntilExpiry(nowSeconds() - 5)).toBe(0);
  });

  it("returns Infinity when expiresAt is null", () => {
    expect(timeUntilExpiry(null)).toBe(Infinity);
  });
});
