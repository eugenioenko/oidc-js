import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nowSeconds } from "oidc-js-core";

const { mockAuthService } = vi.hoisted(() => {
  const mockAuthService = {
    isLoading: vi.fn().mockReturnValue(false),
    isAuthenticated: vi.fn().mockReturnValue(false),
    tokens: vi.fn().mockReturnValue({ access: null, id: null, refresh: null, expiresAt: null }),
    login: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  };
  return { mockAuthService };
});

vi.mock("@angular/core", () => ({
  Injectable: () => (target: unknown) => target,
  InjectionToken: class {
    constructor(public desc: string) {}
  },
  DestroyRef: class {},
  signal: (v: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (() => v) as any;
    fn.set = () => {};
    fn.asReadonly = () => fn;
    return fn;
  },
  inject: vi.fn().mockReturnValue(mockAuthService),
}));

vi.mock("@angular/router", () => ({
  Router: class {},
}));

import { authGuard } from "../auth.guard.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthService.isLoading.mockReturnValue(false);
  mockAuthService.isAuthenticated.mockReturnValue(false);
  mockAuthService.tokens.mockReturnValue({ access: null, id: null, refresh: null, expiresAt: null });
  mockAuthService.login.mockResolvedValue(undefined);
  mockAuthService.refresh.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("authGuard", () => {
  it("allows navigation when authenticated and token not expired", async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.tokens.mockReturnValue({
      access: "token",
      id: null,
      refresh: null,
      expiresAt: nowSeconds() + 3600,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = {} as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = { url: "/protected" } as any;
    const result = await authGuard(route, state);

    expect(result).toBe(true);
    expect(mockAuthService.login).not.toHaveBeenCalled();
  });

  it("redirects to login when not authenticated", async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = {} as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = { url: "/protected" } as any;
    const result = await authGuard(route, state);

    expect(result).toBe(false);
    expect(mockAuthService.login).toHaveBeenCalledWith({ returnTo: "/protected" });
  });

  it("attempts refresh when authenticated but token expired", async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.tokens.mockReturnValue({
      access: "expired",
      id: null,
      refresh: "rt",
      expiresAt: nowSeconds() - 60,
    });
    mockAuthService.refresh.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = {} as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = { url: "/protected" } as any;
    const result = await authGuard(route, state);

    expect(mockAuthService.refresh).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("redirects to login when refresh fails", async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.tokens.mockReturnValue({
      access: "expired",
      id: null,
      refresh: "rt",
      expiresAt: nowSeconds() - 60,
    });
    mockAuthService.refresh.mockRejectedValue(new Error("expired"));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = {} as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = { url: "/protected" } as any;
    const result = await authGuard(route, state);

    expect(mockAuthService.refresh).toHaveBeenCalled();
    expect(mockAuthService.login).toHaveBeenCalledWith({ returnTo: "/protected" });
    expect(result).toBe(false);
  });

  it("waits for loading to complete before checking auth", async () => {
    let isLoading = true;
    mockAuthService.isLoading.mockImplementation(() => isLoading);
    mockAuthService.isAuthenticated.mockReturnValue(true);
    mockAuthService.tokens.mockReturnValue({
      access: "token",
      id: null,
      refresh: null,
      expiresAt: nowSeconds() + 3600,
    });

    setTimeout(() => {
      isLoading = false;
    }, 100);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const route = {} as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = { url: "/protected" } as any;
    const result = await authGuard(route, state);

    expect(result).toBe(true);
  });
});
