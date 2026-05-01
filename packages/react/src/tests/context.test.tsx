import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
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
let locationHref: string;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  locationHref = "http://localhost:3000";
  Object.defineProperty(window, "location", {
    value: {
      href: locationHref,
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

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider config={CONFIG}>{children}</AuthProvider>;
}

function wrapperWithProfile({ children }: { children: ReactNode }) {
  return (
    <AuthProvider config={CONFIG} fetchProfile={true}>
      {children}
    </AuthProvider>
  );
}

function wrapperNoProfile({ children }: { children: ReactNode }) {
  return (
    <AuthProvider config={CONFIG} fetchProfile={false}>
      {children}
    </AuthProvider>
  );
}

describe("useAuth", () => {
  it("throws when used outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});

describe("AuthProvider", () => {
  it("fetches discovery on mount", async () => {
    mockFetchResponses(DISCOVERY);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://auth.example.com/.well-known/openid-configuration",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("initial state is unauthenticated after discovery", async () => {
    mockFetchResponses(DISCOVERY);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.tokens).toEqual({ access: null, id: null, refresh: null });
  });

  it("exposes config in context", async () => {
    mockFetchResponses(DISCOVERY);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.config).toEqual(CONFIG);
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

    const { result } = renderHook(() => useAuth(), { wrapper: wrapperWithProfile });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.tokens.access).toBe("at_123");
    expect(result.current.tokens.id).toBe(TOKEN_RESPONSE.id_token);
    expect(result.current.tokens.refresh).toBe("rt_123");
    expect(result.current.user?.claims.sub).toBe("user-1");
    expect(result.current.user?.profile?.email).toBe("user@example.com");
    expect(window.history.replaceState).toHaveBeenCalled();
    expect(sessionStorage.getItem("oidc-js:auth-state")).toBeNull();
  });

  it("skips profile fetch when fetchProfile is false", async () => {
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

    const { result } = renderHook(() => useAuth(), { wrapper: wrapperNoProfile });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user?.claims.sub).toBe("user-1");
    expect(result.current.user?.profile).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sets error when session storage is empty during callback", async () => {
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost:3000?code=auth_code&state=test-state",
        search: "?code=auth_code&state=test-state",
        pathname: "/",
      },
      writable: true,
      configurable: true,
    });

    mockFetchResponses(DISCOVERY);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain("Missing auth state");
  });

  it("sets error on discovery fetch failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("no json")),
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
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

    const { result } = renderHook(() => useAuth(), { wrapper: wrapperNoProfile });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.actions.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.tokens).toEqual({ access: null, id: null, refresh: null });
  });
});
