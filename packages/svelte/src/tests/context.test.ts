import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OidcConfig } from "oidc-js-core";

const mockClientInstance = {
  subscribe: vi.fn((cb: (state: unknown) => void) => {
    return vi.fn();
  }),
  init: vi.fn().mockResolvedValue({ returnTo: undefined }),
  login: vi.fn().mockResolvedValue(undefined),
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

let contextStore: Map<unknown, unknown> = new Map();

vi.mock("svelte", async () => {
  const actual = await vi.importActual<typeof import("svelte")>("svelte");
  return {
    ...actual,
    setContext: (key: unknown, value: unknown) => { contextStore.set(key, value); },
    getContext: (key: unknown) => contextStore.get(key),
  };
});

import { AuthStateManager, getAuthContext, setAuthContext } from "../context.svelte.js";

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

beforeEach(() => {
  vi.clearAllMocks();
  contextStore = new Map();
  mockClientInstance.init.mockResolvedValue({ returnTo: undefined });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthStateManager", () => {
  it("creates OidcClient with config", async () => {
    const { OidcClient } = await vi.importMock<typeof import("oidc-js")>("oidc-js");
    new AuthStateManager(CONFIG, true);

    expect(OidcClient).toHaveBeenCalledWith({ ...CONFIG, fetchProfile: true });
  });

  it("exposes config and client", () => {
    const manager = new AuthStateManager(CONFIG, false);

    expect(manager.config).toEqual(CONFIG);
    expect(manager.client).toBeDefined();
  });

  it("has correct initial state", () => {
    const manager = new AuthStateManager(CONFIG, true);

    expect(manager.user).toBeNull();
    expect(manager.isAuthenticated).toBe(false);
    expect(manager.isLoading).toBe(true);
    expect(manager.error).toBeNull();
    expect(manager.tokens).toEqual({ access: null, id: null, refresh: null, expiresAt: null });
  });

  it("updates state via update()", () => {
    const manager = new AuthStateManager(CONFIG, true);

    manager.update({
      user: { claims: { sub: "user-1" }, profile: null } as any,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      tokens: { access: "at_123", id: null, refresh: null, expiresAt: null },
    });

    expect(manager.isAuthenticated).toBe(true);
    expect(manager.isLoading).toBe(false);
    expect(manager.tokens.access).toBe("at_123");
    expect(manager.user?.claims.sub).toBe("user-1");
  });

  it("exposes actions that delegate to client", () => {
    const manager = new AuthStateManager(CONFIG, true);

    manager.actions.login();
    expect(mockClientInstance.login).toHaveBeenCalled();

    manager.actions.logout();
    expect(mockClientInstance.logout).toHaveBeenCalled();

    manager.actions.refresh();
    expect(mockClientInstance.refresh).toHaveBeenCalled();

    manager.actions.fetchProfile();
    expect(mockClientInstance.fetchProfile).toHaveBeenCalled();
  });
});

describe("getAuthContext", () => {
  it("throws when called outside of AuthProvider", () => {
    expect(() => getAuthContext()).toThrow(
      "getAuthContext must be used within an AuthProvider",
    );
  });
});

describe("setAuthContext / getAuthContext round-trip", () => {
  it("setAuthContext stores context retrievable by getAuthContext", () => {
    const manager = new AuthStateManager(CONFIG, true);

    setAuthContext(manager);
    const ctx = getAuthContext();

    expect(ctx.config).toEqual(CONFIG);
    expect(ctx.isLoading).toBe(true);
    expect(ctx.actions).toBeDefined();
  });
});
