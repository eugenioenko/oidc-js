import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@solidjs/testing-library";
import { RequireAuth } from "../auth-required.js";
import type { AuthContextValue } from "../types.js";

const mockAuth: AuthContextValue = {
  config: { issuer: "https://auth.example.com", clientId: "app" },
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  tokens: { access: null, id: null, refresh: null, expiresAt: null },
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

function resetAuth(overrides: Partial<AuthContextValue> = {}) {
  Object.assign(mockAuth, {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    tokens: { access: null, id: null, refresh: null, expiresAt: null },
    actions: {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new Error("No refresh token")),
      fetchProfile: vi.fn(),
    },
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetAuth();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RequireAuth", () => {
  it("renders children when authenticated", () => {
    resetAuth({
      isAuthenticated: true,
      tokens: { access: "token", id: null, refresh: null, expiresAt: Date.now() + 3600_000 },
    });

    render(() => (
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>
    ));

    expect(screen.getByText("Protected")).toBeDefined();
  });

  it("renders fallback when loading", () => {
    resetAuth({ isLoading: true });

    render(() => (
      <RequireAuth fallback={<div>Loading...</div>}>
        <div>Protected</div>
      </RequireAuth>
    ));

    expect(screen.getByText("Loading...")).toBeDefined();
    expect(screen.queryByText("Protected")).toBeNull();
  });

  it("calls login when not authenticated and autoRefresh is false", async () => {
    const actions = {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new Error("no token")),
      fetchProfile: vi.fn(),
    };
    resetAuth({ actions });

    render(() => (
      <RequireAuth autoRefresh={false}>
        <div>Protected</div>
      </RequireAuth>
    ));

    await waitFor(() => {
      expect(actions.login).toHaveBeenCalled();
    });
  });

  it("attempts refresh before login when autoRefresh is true", async () => {
    const actions = {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new Error("no token")),
      fetchProfile: vi.fn(),
    };
    resetAuth({ actions });

    render(() => (
      <RequireAuth autoRefresh={true}>
        <div>Protected</div>
      </RequireAuth>
    ));

    await waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(actions.login).toHaveBeenCalled();
    });
  });

  it("triggers refresh when access token is expired", async () => {
    const actions = {
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn().mockResolvedValue(undefined),
      fetchProfile: vi.fn(),
    };
    resetAuth({
      isAuthenticated: true,
      tokens: { access: "expired", id: null, refresh: "valid-refresh", expiresAt: Date.now() - 60_000 },
      actions,
    });

    render(() => (
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>
    ));

    await waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });
  });
});
