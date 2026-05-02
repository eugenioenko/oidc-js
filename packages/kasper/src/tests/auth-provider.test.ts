import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { OidcConfig } from "oidc-js-core";

const mockClientInstance = {
  subscribe: vi.fn((_cb: (state: unknown) => void) => vi.fn()),
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

import { AuthProvider } from "../auth-provider.js";
import { _destroyAuth, useAuth } from "../context.js";

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

beforeEach(() => {
  vi.clearAllMocks();
  _destroyAuth();
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

afterEach(() => {
  _destroyAuth();
  vi.restoreAllMocks();
});

interface AuthProviderArgs {
  config: OidcConfig;
  fetchProfile?: boolean;
  onLogin?: (returnTo: string) => void;
  onError?: (error: Error) => void;
}

function createProvider(args: AuthProviderArgs): AuthProvider {
  return new AuthProvider({ args } as never);
}

describe("AuthProvider", () => {
  it("initializes auth context on mount", () => {
    const provider = createProvider({ config: CONFIG });
    provider.onMount();

    const auth = useAuth();
    expect(auth.config).toEqual(CONFIG);
  });

  it("calls client.init() on mount", () => {
    const provider = createProvider({ config: CONFIG });
    provider.onMount();

    expect(mockClientInstance.init).toHaveBeenCalled();
  });

  it("defaults fetchProfile to true", async () => {
    const { OidcClient } =
      await vi.importMock<typeof import("oidc-js")>("oidc-js");

    const provider = createProvider({ config: CONFIG });
    provider.onMount();

    expect(OidcClient).toHaveBeenCalledWith({ ...CONFIG, fetchProfile: true });
  });

  it("passes fetchProfile=false when configured", async () => {
    const { OidcClient } =
      await vi.importMock<typeof import("oidc-js")>("oidc-js");

    const provider = createProvider({
      config: CONFIG,
      fetchProfile: false,
    });
    provider.onMount();

    expect(OidcClient).toHaveBeenCalledWith({ ...CONFIG, fetchProfile: false });
  });

  it("calls onLogin callback with returnTo after init", async () => {
    mockClientInstance.init.mockResolvedValueOnce({ returnTo: "/dashboard" });
    const onLogin = vi.fn();

    const provider = createProvider({ config: CONFIG, onLogin });
    provider.onMount();

    await vi.waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("defaults to history.replaceState when no onLogin", async () => {
    mockClientInstance.init.mockResolvedValueOnce({ returnTo: "/dashboard" });

    const provider = createProvider({ config: CONFIG });
    provider.onMount();

    await vi.waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        "",
        "/dashboard",
      );
    });
  });

  it("does not call onLogin when returnTo is undefined", async () => {
    mockClientInstance.init.mockResolvedValueOnce({ returnTo: undefined });
    const onLogin = vi.fn();

    const provider = createProvider({ config: CONFIG, onLogin });
    provider.onMount();

    await vi.waitFor(() => {
      expect(mockClientInstance.init).toHaveBeenCalled();
    });

    expect(onLogin).not.toHaveBeenCalled();
  });

  it("calls onError when init results in error state", async () => {
    const error = new Error("discovery failed");
    mockClientInstance.init.mockResolvedValueOnce({ returnTo: undefined });
    const origState = mockClientInstance.state;
    mockClientInstance.state = { ...origState, error } as unknown as typeof origState;
    const onError = vi.fn();

    const provider = createProvider({ config: CONFIG, onError });
    provider.onMount();

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });

    mockClientInstance.state = origState;
  });

  it("cleans up on destroy", () => {
    const unsubFn = vi.fn();
    mockClientInstance.subscribe.mockReturnValueOnce(unsubFn);

    const provider = createProvider({ config: CONFIG });
    provider.onMount();
    provider.onDestroy();

    expect(unsubFn).toHaveBeenCalled();
    expect(mockClientInstance.destroy).toHaveBeenCalled();
    expect(() => useAuth()).toThrow(
      "useAuth must be used within an AuthProvider",
    );
  });
});
