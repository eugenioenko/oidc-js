import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createApp, defineComponent, inject } from "vue";
import { oidcPlugin, AUTH_CONTEXT_KEY } from "../plugin.js";
import type { OidcConfig } from "oidc-js-core";

let mockSubscribeCb: ((state: unknown) => void) | null = null;
const mockClient = {
  subscribe: vi.fn((cb: (state: unknown) => void) => {
    mockSubscribeCb = cb;
    return vi.fn();
  }),
  init: vi.fn().mockResolvedValue({ returnTo: undefined }),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  fetchProfile: vi.fn(),
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
    return mockClient;
  }),
}));

const CONFIG: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscribeCb = null;
  mockClient.subscribe.mockImplementation((cb: (state: unknown) => void) => {
    mockSubscribeCb = cb;
    return vi.fn();
  });
  mockClient.init.mockResolvedValue({ returnTo: undefined });
  mockClient.state = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    tokens: { access: null, id: null, refresh: null, expiresAt: null },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mountAppWithPlugin(
  options: Record<string, unknown> = {},
  childSetup?: (ctx: unknown) => void,
) {
  let context: unknown = null;

  const Child = defineComponent({
    setup() {
      context = inject(AUTH_CONTEXT_KEY);
      if (childSetup) childSetup(context);
      return () => null;
    },
  });

  const App = defineComponent({
    components: { Child },
    template: "<Child />",
  });

  const app = createApp(App);
  app.use(oidcPlugin, { config: CONFIG, ...options });

  const root = document.createElement("div");
  document.body.appendChild(root);
  app.mount(root);

  return { app, root, getContext: () => context };
}

describe("oidcPlugin", () => {
  it("provides auth context to components", () => {
    const { app, root, getContext } = mountAppWithPlugin();
    const context = getContext();

    expect(context).not.toBeNull();
    expect(context).toHaveProperty("config", CONFIG);
    expect(context).toHaveProperty("actions");

    app.unmount();
    document.body.removeChild(root);
  });

  it("creates OidcClient with config and fetchProfile", async () => {
    const { OidcClient } = await vi.importMock<typeof import("oidc-js")>("oidc-js");

    const { app, root } = mountAppWithPlugin({ fetchProfile: false });

    expect(OidcClient).toHaveBeenCalledWith({ ...CONFIG, fetchProfile: false });

    app.unmount();
    document.body.removeChild(root);
  });

  it("calls onError when init produces an error", async () => {
    const error = new Error("Discovery failed");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClient.state = { ...mockClient.state, error } as any;

    const onError = vi.fn();
    const { app, root } = mountAppWithPlugin({ onError });

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });

    app.unmount();
    document.body.removeChild(root);
  });

  it("calls onLogin when returnTo is present", async () => {
    mockClient.init.mockResolvedValue({ returnTo: "/dashboard" });

    const onLogin = vi.fn();
    const { app, root } = mountAppWithPlugin({ onLogin });

    await vi.waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith("/dashboard");
    });

    app.unmount();
    document.body.removeChild(root);
  });

  it("cleans up on unmount", () => {
    const unsub = vi.fn();
    mockClient.subscribe.mockReturnValue(unsub);

    const { app, root } = mountAppWithPlugin();
    app.unmount();
    document.body.removeChild(root);

    expect(unsub).toHaveBeenCalled();
    expect(mockClient.destroy).toHaveBeenCalled();
  });

  it("updates reactive refs when state changes", () => {
    const { app, root, getContext } = mountAppWithPlugin();

    expect(mockSubscribeCb).not.toBeNull();

    mockSubscribeCb!({
      user: { claims: { sub: "user-1" }, profile: null },
      isAuthenticated: true,
      isLoading: false,
      error: null,
      tokens: { access: "at_123", id: null, refresh: null, expiresAt: null },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = getContext() as any;
    expect(context.isAuthenticated.value).toBe(true);
    expect(context.tokens.value.access).toBe("at_123");

    app.unmount();
    document.body.removeChild(root);
  });
});
