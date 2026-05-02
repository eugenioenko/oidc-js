import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactiveControllerHost } from "lit";
import { AuthController } from "../auth-controller.js";
import type { OidcConfig } from "oidc-js-core";

let mockSubscribeCb: ((state: unknown) => void) | null = null;
let mockUnsub: ReturnType<typeof vi.fn>;
const mockClientInstance = {
  subscribe: vi.fn((cb: (state: unknown) => void) => {
    mockSubscribeCb = cb;
    return mockUnsub;
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

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

function createMockHost(): ReactiveControllerHost {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscribeCb = null;
  mockUnsub = vi.fn();
  mockClientInstance.init.mockResolvedValue({ returnTo: undefined });
  mockClientInstance.state = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    tokens: { access: null, id: null, refresh: null, expiresAt: null },
  };
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthController", () => {
  it("registers with the host on construction", () => {
    const host = createMockHost();
    new AuthController(host, { config: CONFIG });

    expect(host.addController).toHaveBeenCalled();
  });

  it("exposes initial state via getters", () => {
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG });

    expect(ctrl.isLoading).toBe(true);
    expect(ctrl.isAuthenticated).toBe(false);
    expect(ctrl.user).toBeNull();
    expect(ctrl.error).toBeNull();
    expect(ctrl.tokens).toEqual({ access: null, id: null, refresh: null, expiresAt: null });
    expect(ctrl.config).toEqual(CONFIG);
  });

  it("creates OidcClient and subscribes on hostConnected", async () => {
    const { OidcClient } = await vi.importMock<typeof import("oidc-js")>("oidc-js");

    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG, fetchProfile: false });
    ctrl.hostConnected();

    expect(OidcClient).toHaveBeenCalledWith({ ...CONFIG, fetchProfile: false });
    expect(mockClientInstance.subscribe).toHaveBeenCalled();
    expect(mockClientInstance.init).toHaveBeenCalled();
  });

  it("updates state and requests host update on subscription callback", () => {
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG });
    ctrl.hostConnected();

    expect(mockSubscribeCb).not.toBeNull();

    mockSubscribeCb!({
      user: { claims: { sub: "user-1" }, profile: null },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      tokens: { access: "at_123", id: null, refresh: null, expiresAt: null },
    });

    expect(ctrl.isAuthenticated).toBe(true);
    expect(ctrl.tokens.access).toBe("at_123");
    expect(ctrl.user?.claims.sub).toBe("user-1");
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it("calls onError when init produces an error", async () => {
    const error = new Error("Discovery failed");
    mockClientInstance.state = { ...mockClientInstance.state, error } as unknown as typeof mockClientInstance.state;

    const onError = vi.fn();
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG, onError });
    ctrl.hostConnected();

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  it("calls onLogin when returnTo is present", async () => {
    mockClientInstance.init.mockResolvedValue({ returnTo: "/dashboard" });

    const onLogin = vi.fn();
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG, onLogin });
    ctrl.hostConnected();

    await vi.waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("cleans up on hostDisconnected", () => {
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG });
    ctrl.hostConnected();
    ctrl.hostDisconnected();

    expect(mockUnsub).toHaveBeenCalled();
    expect(mockClientInstance.destroy).toHaveBeenCalled();
  });

  it("delegates login to client", async () => {
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG });
    ctrl.hostConnected();

    await ctrl.login({ returnTo: "/page" });
    expect(mockClientInstance.login).toHaveBeenCalledWith({ returnTo: "/page" });
  });

  it("delegates logout to client", () => {
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG });
    ctrl.hostConnected();

    ctrl.logout();
    expect(mockClientInstance.logout).toHaveBeenCalled();
  });

  it("delegates refresh to client", async () => {
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG });
    ctrl.hostConnected();

    await ctrl.refresh();
    expect(mockClientInstance.refresh).toHaveBeenCalled();
  });

  it("delegates fetchProfile to client", async () => {
    const host = createMockHost();
    const ctrl = new AuthController(host, { config: CONFIG });
    ctrl.hostConnected();

    await ctrl.fetchProfile();
    expect(mockClientInstance.fetchProfile).toHaveBeenCalled();
  });
});
