import { ref, type App, type InjectionKey, type Ref } from "vue";
import { OidcClient, type AuthState, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthActions, AuthContextValue, OidcPluginOptions } from "./types.js";

/**
 * Vue injection key for the authentication context.
 *
 * Used internally by the {@link oidcPlugin} and {@link useAuth} composable
 * to provide and inject the reactive auth state.
 */
export const AUTH_CONTEXT_KEY: InjectionKey<{
  config: OidcConfig;
  user: Ref<AuthContextValue["user"]>;
  isAuthenticated: Ref<boolean>;
  isLoading: Ref<boolean>;
  error: Ref<Error | null>;
  tokens: Ref<AuthContextValue["tokens"]>;
  actions: AuthActions;
}> = Symbol("oidc-auth");

/**
 * Vue plugin that initializes the OIDC client and provides reactive auth state.
 *
 * Install via `app.use(oidcPlugin, options)`. Creates an {@link OidcClient},
 * calls `init()`, subscribes to state changes, and stores state in Vue reactive
 * refs via `app.provide()`. The client is destroyed when the app unmounts.
 *
 * @example
 * ```ts
 * import { createApp } from "vue";
 * import { oidcPlugin } from "oidc-js-vue";
 *
 * const app = createApp(App);
 * app.use(oidcPlugin, {
 *   config: {
 *     issuer: "https://accounts.example.com",
 *     clientId: "my-app",
 *     redirectUri: "http://localhost:3000/callback",
 *     scopes: ["openid", "profile", "email"],
 *   },
 * });
 * app.mount("#app");
 * ```
 *
 * @param app - The Vue application instance.
 * @param options - Plugin options including OIDC config and optional callbacks.
 */
export const oidcPlugin = {
  install(app: App, options: OidcPluginOptions): void {
    const { config, fetchProfile = true, onLogin, onError } = options;

    const client = new OidcClient({ ...config, fetchProfile });

    const user = ref<AuthContextValue["user"]>(null);
    const isAuthenticated = ref(false);
    const isLoading = ref(true);
    const error = ref<Error | null>(null);
    const tokens = ref<AuthContextValue["tokens"]>({
      access: null,
      id: null,
      refresh: null,
      expiresAt: null,
    });

    const unsub = client.subscribe((state: AuthState) => {
      user.value = state.user;
      isAuthenticated.value = state.isAuthenticated;
      isLoading.value = state.isLoading;
      error.value = state.error;
      tokens.value = state.tokens;
    });

    client.init().then(({ returnTo }) => {
      const s = client.state;
      if (s.error) onError?.(s.error);
      if (returnTo) {
        if (onLogin) {
          onLogin(returnTo);
        } else {
          window.history.replaceState({}, "", returnTo);
        }
      }
    });

    const login = async (loginOptions?: LoginOptions) => {
      await client.login(loginOptions);
    };

    const logout = () => {
      client.logout();
    };

    const refresh = async () => {
      await client.refresh();
    };

    const doFetchProfile = async () => {
      await client.fetchProfile();
    };

    const actions: AuthActions = {
      login,
      logout,
      refresh,
      fetchProfile: doFetchProfile,
    };

    app.provide(AUTH_CONTEXT_KEY, {
      config,
      user,
      isAuthenticated,
      isLoading,
      error,
      tokens,
      actions,
    });

    const originalUnmount = app.unmount.bind(app);
    app.unmount = () => {
      unsub();
      client.destroy();
      originalUnmount();
    };
  },
};
