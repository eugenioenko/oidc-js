import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockMakeEnvironmentProviders } = vi.hoisted(() => {
  const mockMakeEnvironmentProviders = vi.fn().mockImplementation((providers: unknown[]) => ({
    providers,
    ɵproviders: providers,
  }));
  return { mockMakeEnvironmentProviders };
});

vi.mock("@angular/core", () => ({
  makeEnvironmentProviders: mockMakeEnvironmentProviders,
  Injectable: () => (target: unknown) => target,
  InjectionToken: class {
    constructor(public desc: string) {}
  },
  DestroyRef: class {},
  APP_INITIALIZER: Symbol("APP_INITIALIZER"),
  signal: (v: unknown) => {
    const fn = (() => v) as any;
    fn.set = () => {};
    fn.asReadonly = () => fn;
    return fn;
  },
  inject: vi.fn(),
}));

vi.mock("@angular/router", () => ({
  Router: class {},
}));

vi.mock("oidc-js", () => ({
  OidcClient: vi.fn().mockImplementation(function () {
    return {
      subscribe: vi.fn(() => vi.fn()),
      init: vi.fn().mockResolvedValue({}),
      destroy: vi.fn(),
      state: { user: null, isAuthenticated: false, isLoading: true, error: null, tokens: { access: null, id: null, refresh: null, expiresAt: null } },
    };
  }),
}));

import { provideAuth } from "../provide-auth.js";
import { AuthService, AUTH_OPTIONS } from "../auth.service.js";
import { APP_INITIALIZER } from "@angular/core";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("provideAuth", () => {
  it("returns EnvironmentProviders", () => {
    const options = {
      config: {
        issuer: "https://auth.example.com",
        clientId: "my-app",
        redirectUri: "http://localhost:3000/callback",
      },
    };

    const result = provideAuth(options);

    expect(mockMakeEnvironmentProviders).toHaveBeenCalled();
    expect(result).toHaveProperty("providers");
  });

  it("includes AUTH_OPTIONS, AuthService, and APP_INITIALIZER providers", () => {
    const options = {
      config: {
        issuer: "https://auth.example.com",
        clientId: "my-app",
        redirectUri: "http://localhost:3000/callback",
      },
    };

    provideAuth(options);

    const providers = mockMakeEnvironmentProviders.mock.calls[0][0];

    const optionsProvider = providers.find(
      (p: Record<string, unknown>) => p.provide === AUTH_OPTIONS,
    );
    expect(optionsProvider).toBeDefined();
    expect(optionsProvider.useValue).toBe(options);

    expect(providers).toContain(AuthService);

    const initProvider = providers.find(
      (p: Record<string, unknown>) => p.provide === APP_INITIALIZER,
    );
    expect(initProvider).toBeDefined();
    expect(initProvider.multi).toBe(true);
    expect(initProvider.deps).toContain(AuthService);
  });
});
