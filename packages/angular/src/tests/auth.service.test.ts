import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

const mockRouter = {
  navigateByUrl: vi.fn(),
};

const mockDestroyRef = {
  onDestroy: vi.fn(),
};

const CONFIG = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

const mockOptions: Record<string, unknown> = {
  config: CONFIG,
  fetchProfile: true,
};

vi.mock("@angular/core", () => {
  function createSignal<T>(initial: T) {
    let value = initial;
    const fn = (() => value) as (() => T) & { set: (v: T) => void; asReadonly: () => () => T };
    fn.set = (v: T) => { value = v; };
    fn.asReadonly = () => (() => value) as () => T;
    return fn;
  }

  const injectFn = vi.fn();
  return {
    Injectable: () => (target: unknown) => target,
    InjectionToken: class {
      constructor(public desc: string) {}
    },
    DestroyRef: class {},
    signal: createSignal,
    inject: injectFn,
  };
});

vi.mock("@angular/router", () => ({
  Router: class {},
}));

import { inject } from "@angular/core";
import { AuthService, AUTH_OPTIONS } from "../auth.service.js";

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

  (inject as unknown as ReturnType<typeof vi.fn>).mockImplementation((token: unknown) => {
    if (token === AUTH_OPTIONS) return mockOptions;
    if ((token as { name?: string })?.name === "Router" || (token as Function)?.toString?.().includes("Router")) return mockRouter;
    return mockDestroyRef;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuthService", () => {
  it("creates OidcClient with config on construction", async () => {
    const { OidcClient } = await vi.importMock<typeof import("oidc-js")>("oidc-js");
    new AuthService();

    expect(OidcClient).toHaveBeenCalledWith({
      ...CONFIG,
      fetchProfile: true,
    });
  });

  it("subscribes to state changes on construction", () => {
    new AuthService();
    expect(mockClientInstance.subscribe).toHaveBeenCalled();
  });

  it("registers cleanup on DestroyRef", () => {
    new AuthService();
    expect(mockDestroyRef.onDestroy).toHaveBeenCalled();
  });

  it("initial signal values are correct", () => {
    const service = new AuthService();

    expect(service.user()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.isLoading()).toBe(true);
    expect(service.error()).toBeNull();
    expect(service.tokens()).toEqual({ access: null, id: null, refresh: null, expiresAt: null });
  });

  it("updates signals when subscription callback fires", () => {
    const service = new AuthService();

    expect(mockSubscribeCb).not.toBeNull();

    mockSubscribeCb!({
      user: { claims: { sub: "user-1" }, profile: null },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      tokens: { access: "at_123", id: null, refresh: null, expiresAt: null },
    });

    expect(service.isAuthenticated()).toBe(true);
    expect(service.tokens().access).toBe("at_123");
  });

  it("init calls client.init and navigates on returnTo", async () => {
    mockClientInstance.init.mockResolvedValue({ returnTo: "/dashboard" });

    const service = new AuthService();
    await service.init();

    expect(mockClientInstance.init).toHaveBeenCalled();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith("/dashboard", { replaceUrl: true });
  });

  it("init calls onLogin callback when provided", async () => {
    mockClientInstance.init.mockResolvedValue({ returnTo: "/dashboard" });
    const onLogin = vi.fn();
    mockOptions.onLogin = onLogin;

    const service = new AuthService();
    await service.init();

    expect(onLogin).toHaveBeenCalledWith("/dashboard");

    delete (mockOptions as Record<string, unknown>).onLogin;
  });

  it("init calls onError when state has error", async () => {
    const error = new Error("Discovery failed");
    mockClientInstance.state = { ...mockClientInstance.state, error } as unknown as typeof mockClientInstance.state;
    const onError = vi.fn();
    mockOptions.onError = onError;

    const service = new AuthService();
    await service.init();

    expect(onError).toHaveBeenCalledWith(error);

    delete (mockOptions as Record<string, unknown>).onError;
  });

  it("login delegates to client", async () => {
    const service = new AuthService();
    await service.login({ returnTo: "/page" });

    expect(mockClientInstance.login).toHaveBeenCalledWith({ returnTo: "/page" });
  });

  it("logout delegates to client", () => {
    const service = new AuthService();
    service.logout();

    expect(mockClientInstance.logout).toHaveBeenCalled();
  });

  it("refresh delegates to client", async () => {
    const service = new AuthService();
    await service.refresh();

    expect(mockClientInstance.refresh).toHaveBeenCalled();
  });

  it("fetchProfile delegates to client", async () => {
    const service = new AuthService();
    await service.fetchProfile();

    expect(mockClientInstance.fetchProfile).toHaveBeenCalled();
  });

  it("cleanup unsubscribes and destroys client", () => {
    new AuthService();

    const destroyCallback = mockDestroyRef.onDestroy.mock.calls[0][0];
    destroyCallback();

    expect(mockUnsub).toHaveBeenCalled();
    expect(mockClientInstance.destroy).toHaveBeenCalled();
  });
});
