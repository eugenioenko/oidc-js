import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nowSeconds } from "oidc-js-core";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { RequireAuth } from "../auth-required.js";
import type { AuthContextValue } from "../types.js";

const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock("../context.js", () => ({
  useAuth: () => mockUseAuth(),
}));

const EMPTY_TOKENS = { access: null, id: null, refresh: null, expiresAt: null };

function makeActions(overrides: Partial<AuthContextValue["actions"]> = {}) {
  return {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error("No refresh token")),
    fetchProfile: vi.fn(),
    ...overrides,
  };
}

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    config: { issuer: "https://auth.example.com", clientId: "app" },
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    tokens: EMPTY_TOKENS,
    actions: makeActions(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("RequireAuth", () => {
  it("renders children when authenticated", () => {
    mockUseAuth.mockReturnValue(
      makeAuth({ isAuthenticated: true, tokens: { access: "token", id: null, refresh: null, expiresAt: nowSeconds() + 3600 } }),
    );

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    );

    expect(screen.getByText("Protected")).toBeDefined();
  });

  it("renders fallback when loading", () => {
    mockUseAuth.mockReturnValue(makeAuth({ isLoading: true }));

    render(
      <RequireAuth fallback={<div>Loading...</div>}>
        <div>Protected</div>
      </RequireAuth>,
    );

    expect(screen.getByText("Loading...")).toBeDefined();
    expect(screen.queryByText("Protected")).toBeNull();
  });

  it("calls login when not authenticated and autoRefresh is false", async () => {
    const actions = makeActions();
    mockUseAuth.mockReturnValue(makeAuth({ actions }));

    render(
      <RequireAuth autoRefresh={false}>
        <div>Protected</div>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(actions.login).toHaveBeenCalled();
    });
  });

  it("attempts refresh before login when autoRefresh is true", async () => {
    const actions = makeActions({
      refresh: vi.fn().mockRejectedValue(new Error("no token")),
    });
    mockUseAuth.mockReturnValue(makeAuth({ actions }));

    render(
      <RequireAuth autoRefresh={true}>
        <div>Protected</div>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(actions.login).toHaveBeenCalled();
    });
  });

  it("triggers refresh when access token is expired", async () => {
    const actions = makeActions({
      refresh: vi.fn().mockResolvedValue(undefined),
    });
    mockUseAuth.mockReturnValue(
      makeAuth({
        isAuthenticated: true,
        tokens: { access: "expired", id: null, refresh: "valid-refresh", expiresAt: nowSeconds() - 60 },
        actions,
      }),
    );

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });
  });

  it("renders children when token is not expired", () => {
    mockUseAuth.mockReturnValue(
      makeAuth({
        isAuthenticated: true,
        tokens: { access: "token", id: null, refresh: null, expiresAt: nowSeconds() + 3600 },
      }),
    );

    render(
      <RequireAuth>
        <div>Protected</div>
      </RequireAuth>,
    );

    expect(screen.getByText("Protected")).toBeDefined();
  });

  it("renders fallback while refreshing", async () => {
    const actions = makeActions({
      refresh: vi.fn().mockReturnValue(new Promise(() => {})),
    });
    mockUseAuth.mockReturnValue(makeAuth({ actions }));

    render(
      <RequireAuth fallback={<div>Loading...</div>}>
        <div>Protected</div>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });

    expect(screen.getByText("Loading...")).toBeDefined();
    expect(screen.queryByText("Protected")).toBeNull();
  });
});
