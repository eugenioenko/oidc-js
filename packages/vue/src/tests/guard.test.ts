import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ref } from "vue";
import { createAuthGuard } from "../guard.js";

const EMPTY_TOKENS = { access: null, id: null, refresh: null, expiresAt: null };

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    inject: vi.fn(),
  };
});

import { inject } from "vue";

function makeActions(overrides: Record<string, unknown> = {}) {
  return {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    fetchProfile: vi.fn(),
    ...overrides,
  };
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    config: { issuer: "https://auth.example.com", clientId: "app" },
    user: ref(null),
    isAuthenticated: ref(false),
    isLoading: ref(false),
    error: ref(null),
    tokens: ref(EMPTY_TOKENS),
    actions: makeActions(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAuthGuard", () => {
  it("throws when used outside plugin", () => {
    vi.mocked(inject).mockReturnValue(undefined);

    const router = { beforeEach: vi.fn() };
    expect(() => createAuthGuard(router)).toThrow(
      "createAuthGuard must be used within a component tree where oidcPlugin is installed",
    );
  });

  it("allows navigation when authenticated", async () => {
    const context = makeContext({
      isAuthenticated: ref(true),
      tokens: ref({ access: "token", id: null, refresh: null, expiresAt: Date.now() + 3600_000 }),
    });
    vi.mocked(inject).mockReturnValue(context);

    const router = { beforeEach: vi.fn() };
    createAuthGuard(router);

    const guard = router.beforeEach.mock.calls[0][0];
    const next = vi.fn();
    await guard({ fullPath: "/protected" }, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("redirects to login when not authenticated", async () => {
    const actions = makeActions();
    const context = makeContext({ actions });
    vi.mocked(inject).mockReturnValue(context);

    const router = { beforeEach: vi.fn() };
    createAuthGuard(router);

    const guard = router.beforeEach.mock.calls[0][0];
    const next = vi.fn();
    await guard({ fullPath: "/protected" }, {}, next);

    expect(actions.login).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: "/protected" }),
    );
    expect(next).toHaveBeenCalledWith(false);
  });

  it("attempts refresh when token is expired", async () => {
    const actions = makeActions();
    const context = makeContext({
      isAuthenticated: ref(true),
      tokens: ref({ access: "expired", id: null, refresh: "rt", expiresAt: Date.now() - 60_000 }),
      actions,
    });
    vi.mocked(inject).mockReturnValue(context);

    const router = { beforeEach: vi.fn() };
    createAuthGuard(router);

    const guard = router.beforeEach.mock.calls[0][0];
    const next = vi.fn();
    await guard({ fullPath: "/protected" }, {}, next);

    expect(actions.refresh).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it("falls back to login when refresh fails", async () => {
    const actions = makeActions({
      refresh: vi.fn().mockRejectedValue(new Error("expired")),
    });
    const context = makeContext({
      isAuthenticated: ref(true),
      tokens: ref({ access: "expired", id: null, refresh: "rt", expiresAt: Date.now() - 60_000 }),
      actions,
    });
    vi.mocked(inject).mockReturnValue(context);

    const router = { beforeEach: vi.fn() };
    createAuthGuard(router);

    const guard = router.beforeEach.mock.calls[0][0];
    const next = vi.fn();
    await guard({ fullPath: "/protected" }, {}, next);

    expect(actions.refresh).toHaveBeenCalled();
    expect(actions.login).toHaveBeenCalledWith(
      expect.objectContaining({ returnTo: "/protected" }),
    );
    expect(next).toHaveBeenCalledWith(false);
  });
});
