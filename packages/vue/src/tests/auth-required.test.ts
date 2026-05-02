import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, ref, provide, h } from "vue";
import { mount } from "@vue/test-utils";
import { RequireAuth } from "../auth-required.js";
import { AUTH_CONTEXT_KEY } from "../plugin.js";

const EMPTY_TOKENS = { access: null, id: null, refresh: null, expiresAt: null };

function makeActions(overrides: Record<string, unknown> = {}) {
  return {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockRejectedValue(new Error("No refresh token")),
    fetchProfile: vi.fn(),
    ...overrides,
  };
}

function makeWrapper(state: Record<string, unknown> = {}) {
  return defineComponent({
    setup(_, { slots }) {
      provide(AUTH_CONTEXT_KEY, {
        config: { issuer: "https://auth.example.com", clientId: "app" },
        user: ref(null),
        isAuthenticated: ref(false),
        isLoading: ref(false),
        error: ref(null),
        tokens: ref(EMPTY_TOKENS),
        actions: makeActions(),
        ...state,
      });
      return () => slots.default?.();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RequireAuth", () => {
  it("renders default slot when authenticated", () => {
    const wrapper = mount(makeWrapper({
      isAuthenticated: ref(true),
      tokens: ref({ access: "token", id: null, refresh: null, expiresAt: Date.now() + 3600_000 }),
    }), {
      slots: {
        default: () => h(RequireAuth, null, {
          default: () => h("div", "Protected"),
        }),
      },
    });

    expect(wrapper.text()).toContain("Protected");
  });

  it("renders fallback slot when loading", () => {
    const wrapper = mount(makeWrapper({
      isLoading: ref(true),
    }), {
      slots: {
        default: () => h(RequireAuth, null, {
          default: () => h("div", "Protected"),
          fallback: () => h("div", "Loading..."),
        }),
      },
    });

    expect(wrapper.text()).toContain("Loading...");
    expect(wrapper.text()).not.toContain("Protected");
  });

  it("calls login when not authenticated and autoRefresh is false", async () => {
    const actions = makeActions();

    mount(makeWrapper({
      actions,
    }), {
      slots: {
        default: () => h(RequireAuth, { autoRefresh: false }, {
          default: () => h("div", "Protected"),
        }),
      },
    });

    await vi.waitFor(() => {
      expect(actions.login).toHaveBeenCalled();
    });
  });

  it("attempts refresh before login when autoRefresh is true", async () => {
    const actions = makeActions({
      refresh: vi.fn().mockRejectedValue(new Error("no token")),
    });

    mount(makeWrapper({
      actions,
    }), {
      slots: {
        default: () => h(RequireAuth, { autoRefresh: true }, {
          default: () => h("div", "Protected"),
        }),
      },
    });

    await vi.waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });

    await vi.waitFor(() => {
      expect(actions.login).toHaveBeenCalled();
    });
  });

  it("triggers refresh when access token is expired", async () => {
    const actions = makeActions({
      refresh: vi.fn().mockResolvedValue(undefined),
    });

    mount(makeWrapper({
      isAuthenticated: ref(true),
      tokens: ref({ access: "expired", id: null, refresh: "valid-refresh", expiresAt: Date.now() - 60_000 }),
      actions,
    }), {
      slots: {
        default: () => h(RequireAuth, null, {
          default: () => h("div", "Protected"),
        }),
      },
    });

    await vi.waitFor(() => {
      expect(actions.refresh).toHaveBeenCalled();
    });
  });
});
