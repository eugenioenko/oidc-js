import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nowSeconds } from "oidc-js-core";
import type { AuthContextValue } from "../types.js";

type MutableAuth = { -readonly [K in keyof AuthContextValue]: AuthContextValue[K] };

const mockAuth: MutableAuth = {
  config: { issuer: "https://auth.example.com", clientId: "app" },
  user: { value: null } as AuthContextValue["user"],
  isAuthenticated: { value: false } as AuthContextValue["isAuthenticated"],
  isLoading: { value: false } as AuthContextValue["isLoading"],
  error: { value: null } as AuthContextValue["error"],
  tokens: {
    value: { access: null, id: null, refresh: null, expiresAt: null },
  } as AuthContextValue["tokens"],
  actions: {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error("No refresh token")),
    fetchProfile: vi.fn(),
  },
};

vi.mock("../context.js", () => ({
  useAuth: () => mockAuth,
}));

import { RequireAuth } from "../require-auth.js";

interface RequireAuthArgs {
  autoRefresh?: boolean;
  loginOptions?: Record<string, string>;
}

let capturedEffects: Array<() => void> = [];

function createRequireAuth(args: RequireAuthArgs = {}): RequireAuth {
  const instance = new RequireAuth({ args } as never);
  const origEffect = instance.effect.bind(instance);
  instance.effect = (fn: () => void) => {
    capturedEffects.push(fn);
    origEffect(fn);
  };
  return instance;
}

function resetAuth(overrides: Partial<MutableAuth> = {}) {
  mockAuth.user = { value: null } as AuthContextValue["user"];
  mockAuth.isAuthenticated = {
    value: false,
  } as AuthContextValue["isAuthenticated"];
  mockAuth.isLoading = { value: false } as AuthContextValue["isLoading"];
  mockAuth.error = { value: null } as AuthContextValue["error"];
  mockAuth.tokens = {
    value: { access: null, id: null, refresh: null, expiresAt: null },
  } as AuthContextValue["tokens"];
  mockAuth.actions = {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error("No refresh token")),
    fetchProfile: vi.fn(),
  };

  if (overrides.isAuthenticated !== undefined)
    mockAuth.isAuthenticated = overrides.isAuthenticated;
  if (overrides.isLoading !== undefined)
    mockAuth.isLoading = overrides.isLoading;
  if (overrides.tokens !== undefined) mockAuth.tokens = overrides.tokens;
  if (overrides.user !== undefined) mockAuth.user = overrides.user;
  if (overrides.error !== undefined) mockAuth.error = overrides.error;
  if (overrides.actions !== undefined) mockAuth.actions = overrides.actions;
}

beforeEach(() => {
  vi.clearAllMocks();
  capturedEffects = [];
  resetAuth();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RequireAuth", () => {
  describe("_ready()", () => {
    it("returns true when authenticated with valid token", () => {
      resetAuth({
        isAuthenticated: { value: true } as AuthContextValue["isAuthenticated"],
        isLoading: { value: false } as AuthContextValue["isLoading"],
        tokens: {
          value: {
            access: "token",
            id: null,
            refresh: null,
            expiresAt: nowSeconds() + 3600,
          },
        } as AuthContextValue["tokens"],
      });

      const guard = createRequireAuth();
      expect(guard._ready()).toBe(true);
    });

    it("returns false when loading", () => {
      resetAuth({
        isLoading: { value: true } as AuthContextValue["isLoading"],
      });

      const guard = createRequireAuth();
      expect(guard._ready()).toBe(false);
    });

    it("returns false when not authenticated", () => {
      resetAuth({
        isAuthenticated: {
          value: false,
        } as AuthContextValue["isAuthenticated"],
      });

      const guard = createRequireAuth();
      expect(guard._ready()).toBe(false);
    });

    it("returns false when token is expired", () => {
      resetAuth({
        isAuthenticated: { value: true } as AuthContextValue["isAuthenticated"],
        isLoading: { value: false } as AuthContextValue["isLoading"],
        tokens: {
          value: {
            access: "expired",
            id: null,
            refresh: null,
            expiresAt: nowSeconds() - 60,
          },
        } as AuthContextValue["tokens"],
      });

      const guard = createRequireAuth();
      expect(guard._ready()).toBe(false);
    });
  });

  describe("effect behavior", () => {
    it("calls login when not authenticated and autoRefresh is false", () => {
      const actions = {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn().mockRejectedValue(new Error("no token")),
        fetchProfile: vi.fn(),
      };
      resetAuth({ actions });

      const guard = createRequireAuth({ autoRefresh: false });
      guard.onMount();

      expect(actions.login).toHaveBeenCalled();
    });

    it("attempts refresh before login when autoRefresh is true", async () => {
      const actions = {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn().mockRejectedValue(new Error("no token")),
        fetchProfile: vi.fn(),
      };
      resetAuth({ actions });

      const guard = createRequireAuth({ autoRefresh: true });
      guard.onMount();

      expect(actions.refresh).toHaveBeenCalled();

      await vi.waitFor(() => {
        expect(actions.login).toHaveBeenCalled();
      });
    });

    it("does not call login when authenticated", () => {
      const actions = {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        fetchProfile: vi.fn(),
      };
      resetAuth({
        isAuthenticated: { value: true } as AuthContextValue["isAuthenticated"],
        tokens: {
          value: {
            access: "token",
            id: null,
            refresh: null,
            expiresAt: nowSeconds() + 3600,
          },
        } as AuthContextValue["tokens"],
        actions,
      });

      const guard = createRequireAuth();
      guard.onMount();

      expect(actions.login).not.toHaveBeenCalled();
      expect(actions.refresh).not.toHaveBeenCalled();
    });

    it("does not act while loading", () => {
      const actions = {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        fetchProfile: vi.fn(),
      };
      resetAuth({
        isLoading: { value: true } as AuthContextValue["isLoading"],
        actions,
      });

      const guard = createRequireAuth();
      guard.onMount();

      expect(actions.login).not.toHaveBeenCalled();
      expect(actions.refresh).not.toHaveBeenCalled();
    });

    it("triggers refresh when token is expired", () => {
      const actions = {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn().mockResolvedValue(undefined),
        fetchProfile: vi.fn(),
      };
      resetAuth({
        isAuthenticated: { value: true } as AuthContextValue["isAuthenticated"],
        tokens: {
          value: {
            access: "expired",
            id: null,
            refresh: "rt",
            expiresAt: nowSeconds() - 60,
          },
        } as AuthContextValue["tokens"],
        actions,
      });

      const guard = createRequireAuth();
      guard.onMount();

      expect(actions.refresh).toHaveBeenCalled();
    });

    it("passes loginOptions to login action", () => {
      const actions = {
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn().mockRejectedValue(new Error("no token")),
        fetchProfile: vi.fn(),
      };
      resetAuth({ actions });

      const loginOptions = { prompt: "login" };
      const guard = createRequireAuth({
        autoRefresh: false,
        loginOptions,
      });
      guard.onMount();

      expect(actions.login).toHaveBeenCalledWith(loginOptions);
    });
  });
});
