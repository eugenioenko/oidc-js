// @ts-nocheck - Preact's h() types require children in props but we pass them as 3rd arg
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/preact";
import { h } from "preact";
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
      makeAuth({
        isAuthenticated: true,
        tokens: { access: "token", id: null, refresh: null, expiresAt: Date.now() + 3600_000 },
      }),
    );

    render(
      h(RequireAuth, null, h("div", null, "Protected")),
    );

    expect(screen.getByText("Protected")).toBeDefined();
  });

  it("renders fallback when loading", () => {
    mockUseAuth.mockReturnValue(makeAuth({ isLoading: true }));

    render(
      h(RequireAuth, { fallback: h("div", null, "Loading...") },
        h("div", null, "Protected"),
      ),
    );

    expect(screen.getByText("Loading...")).toBeDefined();
    expect(screen.queryByText("Protected")).toBeNull();
  });

  it("calls login when not authenticated and autoRefresh is false", async () => {
    const actions = makeActions();
    mockUseAuth.mockReturnValue(makeAuth({ actions }));

    render(
      h(RequireAuth, { autoRefresh: false }, h("div", null, "Protected")),
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
      h(RequireAuth, { autoRefresh: true }, h("div", null, "Protected")),
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
        tokens: { access: "expired", id: null, refresh: "valid-refresh", expiresAt: Date.now() - 60_000 },
        actions,
      }),
    );

    render(
      h(RequireAuth, null, h("div", null, "Protected")),
    );

    await waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });
  });

  it("renders children when token is not expired", () => {
    mockUseAuth.mockReturnValue(
      makeAuth({
        isAuthenticated: true,
        tokens: { access: "token", id: null, refresh: null, expiresAt: Date.now() + 3600_000 },
      }),
    );

    render(
      h(RequireAuth, null, h("div", null, "Protected")),
    );

    expect(screen.getByText("Protected")).toBeDefined();
  });
});
