import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, ref } from "vue";
import { mount } from "@vue/test-utils";
import { useAuth } from "../composable.js";
import { AUTH_CONTEXT_KEY } from "../plugin.js";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const EMPTY_TOKENS = { access: null, id: null, refresh: null, expiresAt: null };

function makeActions() {
  return {
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue(undefined),
    fetchProfile: vi.fn().mockResolvedValue(undefined),
  };
}

describe("useAuth", () => {
  it("throws when used outside oidcPlugin", () => {
    const Comp = defineComponent({
      setup() {
        useAuth();
        return () => null;
      },
    });

    expect(() => mount(Comp)).toThrow(
      "useAuth must be used within a component tree where oidcPlugin is installed",
    );
  });

  it("returns computed refs from provided context", () => {
    const actions = makeActions();
    const config = { issuer: "https://auth.example.com", clientId: "app" };

    let result: ReturnType<typeof useAuth> | null = null;

    const Comp = defineComponent({
      setup() {
        result = useAuth();
        return () => null;
      },
    });

    mount(Comp, {
      global: {
        provide: {
          [AUTH_CONTEXT_KEY as symbol]: {
            config,
            user: ref(null),
            isAuthenticated: ref(false),
            isLoading: ref(false),
            error: ref(null),
            tokens: ref(EMPTY_TOKENS),
            actions,
          },
        },
      },
    });

    expect(result).not.toBeNull();
    expect(result!.isAuthenticated.value).toBe(false);
    expect(result!.isLoading.value).toBe(false);
    expect(result!.user.value).toBeNull();
    expect(result!.error.value).toBeNull();
    expect(result!.tokens.value).toEqual(EMPTY_TOKENS);
    expect(result!.actions).toBe(actions);
    expect(result!.config).toBe(config);
  });

  it("computed refs react to context changes", () => {
    const isAuthenticated = ref(false);

    let result: ReturnType<typeof useAuth> | null = null;

    const Comp = defineComponent({
      setup() {
        result = useAuth();
        return () => null;
      },
    });

    mount(Comp, {
      global: {
        provide: {
          [AUTH_CONTEXT_KEY as symbol]: {
            config: { issuer: "https://auth.example.com", clientId: "app" },
            user: ref(null),
            isAuthenticated,
            isLoading: ref(false),
            error: ref(null),
            tokens: ref(EMPTY_TOKENS),
            actions: makeActions(),
          },
        },
      },
    });

    expect(result!.isAuthenticated.value).toBe(false);

    isAuthenticated.value = true;
    expect(result!.isAuthenticated.value).toBe(true);
  });
});
