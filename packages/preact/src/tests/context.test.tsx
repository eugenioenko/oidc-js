// @ts-nocheck - Preact's h() types require children in props but we pass them as 3rd arg
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, act } from "@testing-library/preact";
import { h } from "preact";
import { AuthProvider, useAuth } from "../context.js";
import type { OidcConfig } from "oidc-js-core";

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

const DISCOVERY = {
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

function makeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

const TOKEN_RESPONSE = {
  access_token: "at_123",
  token_type: "Bearer",
  id_token: makeJwt({
    sub: "user-1",
    iss: "https://auth.example.com",
    aud: "my-app",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    nonce: "test-nonce",
  }),
  refresh_token: "rt_123",
};

const USERINFO = {
  sub: "user-1",
  email: "user@example.com",
  name: "Test User",
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  Object.defineProperty(window, "location", {
    value: {
      href: "http://localhost:3000",
      search: "",
      pathname: "/",
    },
    writable: true,
    configurable: true,
  });

  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockFetchResponses(...responses: unknown[]) {
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
    });
  }
}

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    function BadComponent() {
      useAuth();
      return null;
    }

    expect(() => render(h(BadComponent, null))).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});

describe("AuthProvider", () => {
  it("fetches discovery on mount", async () => {
    mockFetchResponses(DISCOVERY);

    let result: ReturnType<typeof useAuth> | null = null;
    function Consumer() {
      result = useAuth();
      return h("div", null, result.isLoading ? "loading" : "ready");
    }

    render(
      h(AuthProvider, { config: CONFIG }, h(Consumer, null)),
    );

    expect(screen.getByText("loading")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeDefined();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.example.com/.well-known/openid-configuration",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("initial state is unauthenticated after discovery", async () => {
    mockFetchResponses(DISCOVERY);

    let result: ReturnType<typeof useAuth> | null = null;
    function Consumer() {
      result = useAuth();
      return h("div", null, result.isLoading ? "loading" : "ready");
    }

    render(
      h(AuthProvider, { config: CONFIG }, h(Consumer, null)),
    );

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeDefined();
    });

    expect(result!.isAuthenticated).toBe(false);
    expect(result!.user).toBeNull();
    expect(result!.error).toBeNull();
    expect(result!.tokens).toEqual({ access: null, id: null, refresh: null, expiresAt: null });
  });

  it("handles OAuth callback with code and state", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000?code=auth_code&state=test-state",
        search: "?code=auth_code&state=test-state",
        pathname: "/",
      },
      writable: true,
      configurable: true,
    });

    sessionStorage.setItem(
      "oidc-js:auth-state",
      JSON.stringify({
        codeVerifier: "test-verifier",
        state: "test-state",
        nonce: "test-nonce",
        redirectUri: "http://localhost:3000/callback",
      }),
    );

    mockFetchResponses(DISCOVERY, TOKEN_RESPONSE, USERINFO);

    let result: ReturnType<typeof useAuth> | null = null;
    function Consumer() {
      result = useAuth();
      return h("div", null, result.isAuthenticated ? "authed" : "not-authed");
    }

    render(
      h(AuthProvider, { config: CONFIG, fetchProfile: true }, h(Consumer, null)),
    );

    await waitFor(() => {
      expect(screen.getByText("authed")).toBeDefined();
    });

    expect(result!.tokens.access).toBe("at_123");
    expect(result!.tokens.refresh).toBe("rt_123");
    expect(result!.user?.claims.sub).toBe("user-1");
    expect(result!.user?.profile?.email).toBe("user@example.com");
  });

  it("sets error on discovery fetch failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("no json")),
    });

    let result: ReturnType<typeof useAuth> | null = null;
    function Consumer() {
      result = useAuth();
      return h("div", null, result.isLoading ? "loading" : "ready");
    }

    render(
      h(AuthProvider, { config: CONFIG }, h(Consumer, null)),
    );

    await waitFor(() => {
      expect(screen.getByText("ready")).toBeDefined();
    });

    expect(result!.error).not.toBeNull();
  });

  it("actions.logout clears state", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000?code=auth_code&state=test-state",
        search: "?code=auth_code&state=test-state",
        pathname: "/",
      },
      writable: true,
      configurable: true,
    });

    sessionStorage.setItem(
      "oidc-js:auth-state",
      JSON.stringify({
        codeVerifier: "test-verifier",
        state: "test-state",
        nonce: "test-nonce",
        redirectUri: "http://localhost:3000/callback",
      }),
    );

    mockFetchResponses(DISCOVERY, TOKEN_RESPONSE);

    let result: ReturnType<typeof useAuth> | null = null;
    function Consumer() {
      result = useAuth();
      return h("div", null, result.isAuthenticated ? "authed" : "not-authed");
    }

    render(
      h(AuthProvider, { config: CONFIG, fetchProfile: false }, h(Consumer, null)),
    );

    await waitFor(() => {
      expect(screen.getByText("authed")).toBeDefined();
    });

    act(() => {
      result!.actions.logout();
    });

    expect(result!.isAuthenticated).toBe(false);
    expect(result!.user).toBeNull();
  });
});
