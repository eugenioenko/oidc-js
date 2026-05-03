import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nowSeconds } from "oidc-js-core";
import type { ReactiveControllerHost } from "lit";
import { RequireAuthController } from "../require-auth.js";
import type { AuthController } from "../auth-controller.js";

function createMockHost(): ReactiveControllerHost {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  };
}

function makeAuth(overrides: Partial<AuthController> = {}): AuthController {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    tokens: { access: null, id: null, refresh: null, expiresAt: null },
    config: { issuer: "https://auth.example.com", clientId: "app" },
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    fetchProfile: vi.fn().mockResolvedValue(undefined),
    hostConnected: vi.fn(),
    hostDisconnected: vi.fn(),
    ...overrides,
  } as unknown as AuthController;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RequireAuthController", () => {
  it("registers with the host on construction", () => {
    const host = createMockHost();
    const auth = makeAuth();
    new RequireAuthController(host, { auth });

    expect(host.addController).toHaveBeenCalled();
  });

  it("authorized is false when not authenticated", () => {
    const host = createMockHost();
    const auth = makeAuth();
    const guard = new RequireAuthController(host, { auth });

    expect(guard.authorized).toBe(false);
  });

  it("authorized is true when authenticated and not expired", () => {
    const host = createMockHost();
    const auth = makeAuth({
      isAuthenticated: true,
      isLoading: false,
      tokens: { access: "token", id: null, refresh: null, expiresAt: nowSeconds() + 3600 },
    });
    const guard = new RequireAuthController(host, { auth });

    expect(guard.authorized).toBe(true);
  });

  it("authorized is false when token is expired", () => {
    const host = createMockHost();
    const auth = makeAuth({
      isAuthenticated: true,
      tokens: { access: "expired", id: null, refresh: null, expiresAt: nowSeconds() - 60 },
    });
    const guard = new RequireAuthController(host, { auth });

    expect(guard.authorized).toBe(false);
  });

  it("authorized is false when loading", () => {
    const host = createMockHost();
    const auth = makeAuth({
      isAuthenticated: true,
      isLoading: true,
      tokens: { access: "token", id: null, refresh: null, expiresAt: nowSeconds() + 3600 },
    });
    const guard = new RequireAuthController(host, { auth });

    expect(guard.authorized).toBe(false);
  });

  it("hostUpdated triggers login when not authenticated and autoRefresh is false", () => {
    const host = createMockHost();
    const auth = makeAuth();
    const guard = new RequireAuthController(host, { auth, autoRefresh: false });

    guard.hostUpdated();

    expect(auth.login).toHaveBeenCalled();
  });

  it("hostUpdated attempts refresh before login when autoRefresh is true", async () => {
    const host = createMockHost();
    const auth = makeAuth({
      refresh: vi.fn().mockRejectedValue(new Error("no token")),
    });
    const guard = new RequireAuthController(host, { auth, autoRefresh: true });

    guard.hostUpdated();

    expect(auth.refresh).toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(auth.login).toHaveBeenCalled();
    });
  });

  it("hostUpdated does nothing when authenticated and not expired", () => {
    const host = createMockHost();
    const auth = makeAuth({
      isAuthenticated: true,
      tokens: { access: "token", id: null, refresh: null, expiresAt: nowSeconds() + 3600 },
    });
    const guard = new RequireAuthController(host, { auth });

    guard.hostUpdated();

    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it("hostUpdated triggers refresh when token is expired", async () => {
    const host = createMockHost();
    const auth = makeAuth({
      isAuthenticated: true,
      tokens: { access: "expired", id: null, refresh: "rt", expiresAt: nowSeconds() - 60 },
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    const guard = new RequireAuthController(host, { auth });

    guard.hostUpdated();

    expect(auth.refresh).toHaveBeenCalled();
  });

  it("hostUpdated does nothing when loading", () => {
    const host = createMockHost();
    const auth = makeAuth({ isLoading: true });
    const guard = new RequireAuthController(host, { auth });

    guard.hostUpdated();

    expect(auth.login).not.toHaveBeenCalled();
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it("hostDisconnected resets refreshAttempted", () => {
    const host = createMockHost();
    const auth = makeAuth({
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    const guard = new RequireAuthController(host, { auth, autoRefresh: true });

    guard.hostUpdated();
    expect(auth.refresh).toHaveBeenCalledTimes(1);

    guard.hostDisconnected();

    guard.hostUpdated();
    expect(auth.refresh).toHaveBeenCalledTimes(2);
  });

  it("passes loginOptions to login", () => {
    const host = createMockHost();
    const auth = makeAuth();
    const loginOptions = { returnTo: "/page" };
    const guard = new RequireAuthController(host, { auth, autoRefresh: false, loginOptions });

    guard.hostUpdated();

    expect(auth.login).toHaveBeenCalledWith(loginOptions);
  });
});
