import { describe, it, expect, beforeEach } from "vitest";
import { saveAuthState, loadAuthState, clearAuthState } from "../storage.js";
import type { AuthState } from "oidc-js-core";

const AUTH_STATE: AuthState = {
  codeVerifier: "test-verifier",
  state: "test-state",
  nonce: "test-nonce",
  redirectUri: "http://localhost:3000/callback",
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("saveAuthState", () => {
  it("serializes to sessionStorage under oidc-js:auth-state", () => {
    saveAuthState(AUTH_STATE);

    const raw = sessionStorage.getItem("oidc-js:auth-state");
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual(AUTH_STATE);
  });
});

describe("loadAuthState", () => {
  it("deserializes valid JSON", () => {
    sessionStorage.setItem("oidc-js:auth-state", JSON.stringify(AUTH_STATE));

    const result = loadAuthState();
    expect(result).toEqual(AUTH_STATE);
  });

  it("returns null for missing key", () => {
    expect(loadAuthState()).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    sessionStorage.setItem("oidc-js:auth-state", "not-json{{{");

    expect(loadAuthState()).toBeNull();
  });
});

describe("clearAuthState", () => {
  it("removes the key from sessionStorage", () => {
    sessionStorage.setItem("oidc-js:auth-state", "test");

    clearAuthState();

    expect(sessionStorage.getItem("oidc-js:auth-state")).toBeNull();
  });
});
