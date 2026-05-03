import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nowSeconds } from "oidc-js-core";
import { OidcClient } from "../client.js";
import type { OidcClientConfig } from "../types.js";

const CONFIG: OidcClientConfig = {
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
  access_token: makeJwt({ sub: "user-1", exp: nowSeconds() + 3600 }),
  token_type: "Bearer",
  id_token: makeJwt({
    sub: "user-1",
    iss: "https://auth.example.com",
    aud: "my-app",
    exp: nowSeconds() + 3600,
    iat: nowSeconds(),
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
      hash: "",
    },
    writable: true,
    configurable: true,
  });

  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  sessionStorage.clear();
});

afterEach(() => {
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

describe("OidcClient", () => {
  describe("init", () => {
    it("fetches discovery and sets isLoading to false", async () => {
      mockFetchResponses(DISCOVERY);
      const client = new OidcClient(CONFIG);

      await client.init();

      expect(client.state.isLoading).toBe(false);
      expect(client.state.isAuthenticated).toBe(false);
      expect(client.state.user).toBeNull();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://auth.example.com/.well-known/openid-configuration",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("handles OAuth callback with code and state", async () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000?code=auth_code&state=test-state",
          search: "?code=auth_code&state=test-state",
          pathname: "/",
          hash: "",
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
          returnTo: "/dashboard",
        }),
      );

      mockFetchResponses(DISCOVERY, TOKEN_RESPONSE, USERINFO);
      const client = new OidcClient(CONFIG);

      const result = await client.init();

      expect(client.state.isAuthenticated).toBe(true);
      expect(client.state.tokens.access).toBe(TOKEN_RESPONSE.access_token);
      expect(client.state.tokens.id).toBe(TOKEN_RESPONSE.id_token);
      expect(client.state.tokens.refresh).toBe("rt_123");
      expect(client.state.tokens.expiresAt).toBeTypeOf("number");
      expect(client.state.user?.claims.sub).toBe("user-1");
      expect(client.state.user?.profile?.email).toBe("user@example.com");
      expect(result.returnTo).toBe("/dashboard");
      expect(sessionStorage.getItem("oidc-js:auth-state")).toBeNull();
    });

    it("skips profile fetch when fetchProfile is false", async () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000?code=auth_code&state=test-state",
          search: "?code=auth_code&state=test-state",
          pathname: "/",
          hash: "",
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
      const client = new OidcClient({ ...CONFIG, fetchProfile: false });

      await client.init();

      expect(client.state.isAuthenticated).toBe(true);
      expect(client.state.user?.profile).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("captures IdP error from callback URL", async () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000?error=access_denied&error_description=User+denied+the+request",
          search: "?error=access_denied&error_description=User+denied+the+request",
          pathname: "/",
          hash: "",
        },
        writable: true,
        configurable: true,
      });

      mockFetchResponses(DISCOVERY);
      const client = new OidcClient(CONFIG);

      await client.init();

      expect(client.state.error?.message).toBe("User denied the request");
      expect(client.state.isAuthenticated).toBe(false);
      expect(window.history.replaceState).toHaveBeenCalled();
    });

    it("sets error when session storage is empty during callback", async () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000?code=auth_code&state=test-state",
          search: "?code=auth_code&state=test-state",
          pathname: "/",
          hash: "",
        },
        writable: true,
        configurable: true,
      });

      mockFetchResponses(DISCOVERY);
      const client = new OidcClient(CONFIG);

      await client.init();

      expect(client.state.error?.message).toContain("Missing auth state");
      expect(client.state.isLoading).toBe(false);
    });

    it("sets error on discovery failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.reject(new Error("no json")),
      });

      const client = new OidcClient(CONFIG);

      await client.init();

      expect(client.state.error).not.toBeNull();
      expect(client.state.isLoading).toBe(false);
    });
  });

  describe("subscribe", () => {
    it("notifies subscribers on state change", async () => {
      mockFetchResponses(DISCOVERY);
      const client = new OidcClient(CONFIG);
      const fn = vi.fn();

      client.subscribe(fn);
      await client.init();

      expect(fn).toHaveBeenCalled();
      const lastState = fn.mock.calls[fn.mock.calls.length - 1][0];
      expect(lastState.isLoading).toBe(false);
    });

    it("returns unsubscribe function", async () => {
      mockFetchResponses(DISCOVERY);
      const client = new OidcClient(CONFIG);
      const fn = vi.fn();

      const unsub = client.subscribe(fn);
      unsub();
      await client.init();

      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("clears state", async () => {
      Object.defineProperty(window, "location", {
        value: {
          href: "http://localhost:3000?code=auth_code&state=test-state",
          search: "?code=auth_code&state=test-state",
          pathname: "/",
          hash: "",
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
      const client = new OidcClient({ ...CONFIG, fetchProfile: false });

      await client.init();
      expect(client.state.isAuthenticated).toBe(true);

      client.logout();

      expect(client.state.isAuthenticated).toBe(false);
      expect(client.state.user).toBeNull();
      expect(client.state.tokens).toEqual({ access: null, id: null, refresh: null, expiresAt: null });
    });
  });

  describe("refresh", () => {
    it("throws when no refresh token is available", async () => {
      mockFetchResponses(DISCOVERY);
      const client = new OidcClient(CONFIG);

      await client.init();

      await expect(client.refresh()).rejects.toThrow("No refresh token available");
    });
  });

  describe("fetchProfile", () => {
    it("throws when no access token is available", async () => {
      mockFetchResponses(DISCOVERY);
      const client = new OidcClient(CONFIG);

      await client.init();

      await expect(client.fetchProfile()).rejects.toThrow("No access token available");
    });
  });

  describe("destroy", () => {
    it("clears subscribers", async () => {
      const client = new OidcClient(CONFIG);
      const fn = vi.fn();

      client.subscribe(fn);
      client.destroy();

      mockFetchResponses(DISCOVERY);
      await client.init();

      expect(fn).not.toHaveBeenCalled();
    });
  });
});
