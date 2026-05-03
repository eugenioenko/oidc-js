import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OidcConfig } from "oidc-js-core";

const mockClientInstance = {
  subscribe: vi.fn((_cb: (state: unknown) => void) => {
    return vi.fn();
  }),
  init: vi.fn().mockResolvedValue({ returnTo: undefined }),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
  fetchProfile: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn(),
  state: {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    tokens: { access: null, id: null, refresh: null, expiresAt: null },
  },
};

vi.mock("oidc-js", () => ({
  OidcClient: vi.fn().mockImplementation(function () {
    return mockClientInstance;
  }),
}));

import { _initAuth, _destroyAuth, useAuth } from "../context.js";

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

beforeEach(() => {
  vi.clearAllMocks();
  _destroyAuth();
});

afterEach(() => {
  _destroyAuth();
  vi.restoreAllMocks();
});

describe("useAuth", () => {
  it("throws when called before _initAuth", () => {
    expect(() => useAuth()).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });

  it("returns auth context after _initAuth", () => {
    _initAuth(CONFIG, true);
    const auth = useAuth();

    expect(auth.config).toEqual(CONFIG);
    expect(auth.user.value).toBeNull();
    expect(auth.isAuthenticated.value).toBe(false);
    expect(auth.isLoading.value).toBe(true);
    expect(auth.error.value).toBeNull();
    expect(auth.tokens.value).toEqual({
      access: null,
      id: null,
      refresh: null,
      expiresAt: null,
    });
  });

  it("exposes actions that delegate to OidcClient", () => {
    _initAuth(CONFIG, true);
    const auth = useAuth();

    auth.actions.login();
    expect(mockClientInstance.login).toHaveBeenCalled();

    auth.actions.logout();
    expect(mockClientInstance.logout).toHaveBeenCalled();

    auth.actions.refresh();
    expect(mockClientInstance.refresh).toHaveBeenCalled();

    auth.actions.fetchProfile();
    expect(mockClientInstance.fetchProfile).toHaveBeenCalled();
  });
});

describe("_initAuth", () => {
  it("creates OidcClient with config and fetchProfile", async () => {
    const { OidcClient } = await vi.importMock<typeof import("oidc-js")>(
      "oidc-js",
    );

    _initAuth(CONFIG, true);

    expect(OidcClient).toHaveBeenCalledWith({ ...CONFIG, fetchProfile: true });
  });

  it("returns client and unsub function", () => {
    const result = _initAuth(CONFIG, false);

    expect(result.client).toBe(mockClientInstance);
    expect(typeof result.unsub).toBe("function");
  });

  it("subscribes to client state changes", () => {
    _initAuth(CONFIG, true);

    expect(mockClientInstance.subscribe).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it("updates signals when subscriber fires", () => {
    _initAuth(CONFIG, true);
    const subscriber = mockClientInstance.subscribe.mock.calls[0][0];

    subscriber({
      user: { claims: { sub: "user-1" }, profile: null },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      tokens: { access: "at_123", id: "id_456", refresh: "rt_789", expiresAt: 9999999999 },
    });

    const auth = useAuth();
    expect(auth.isAuthenticated.value).toBe(true);
    expect(auth.isLoading.value).toBe(false);
    expect(auth.user.value?.claims.sub).toBe("user-1");
    expect(auth.tokens.value.access).toBe("at_123");
  });
});

describe("_destroyAuth", () => {
  it("resets all signals to initial values", () => {
    _initAuth(CONFIG, true);
    const subscriber = mockClientInstance.subscribe.mock.calls[0][0];

    subscriber({
      user: { claims: { sub: "user-1" }, profile: null },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      tokens: { access: "at_123", id: null, refresh: null, expiresAt: null },
    });

    _destroyAuth();

    expect(() => useAuth()).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});

describe("logout unsubscribes before calling client", () => {
  it("unsubscribes from state changes before logout redirect", () => {
    const unsubFn = vi.fn();
    mockClientInstance.subscribe.mockReturnValueOnce(unsubFn);

    _initAuth(CONFIG, true);
    const auth = useAuth();

    auth.actions.logout();

    expect(unsubFn).toHaveBeenCalled();
    expect(mockClientInstance.logout).toHaveBeenCalled();

    const unsubOrder = unsubFn.mock.invocationCallOrder[0];
    const logoutOrder = mockClientInstance.logout.mock.invocationCallOrder[0];
    expect(unsubOrder).toBeLessThan(logoutOrder);
  });
});
