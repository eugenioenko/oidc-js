import { signal, batch } from "kasper-js";
import { OidcClient, type AuthState, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthContextValue, AuthActions } from "./types.js";

const _user = signal<AuthState["user"]>(null);
const _isAuthenticated = signal(false);
const _isLoading = signal(true);
const _error = signal<AuthState["error"]>(null);
const _tokens = signal<AuthState["tokens"]>({
  access: null,
  id: null,
  refresh: null,
  expiresAt: null,
});

let _client: OidcClient | null = null;
let _config: OidcConfig | null = null;
let _actions: AuthActions | null = null;
let _unsub: (() => void) | null = null;

/** @internal */
export function _initAuth(
  config: OidcConfig,
  fetchProfile: boolean,
): { client: OidcClient; unsub: () => void } {
  const client = new OidcClient({ ...config, fetchProfile });
  _client = client;
  _config = config;
  _actions = {
    login: (options?: LoginOptions) => {
      client.login(options);
    },
    logout: () => {
      // Unsubscribe before logout to prevent RequireAuth from reacting
      // to the intermediate unauthenticated state and racing with the
      // logout redirect by triggering a login redirect.
      _unsub?.();
      client.logout();
    },
    refresh: () => client.refresh(),
    fetchProfile: () => client.fetchProfile(),
  };

  const unsub = client.subscribe((state: AuthState) => {
    batch(() => {
      _user.value = state.user;
      _isAuthenticated.value = state.isAuthenticated;
      _isLoading.value = state.isLoading;
      _error.value = state.error;
      _tokens.value = state.tokens;
    });
  });
  _unsub = unsub;

  return { client, unsub };
}

/** @internal */
export function _destroyAuth(): void {
  _client = null;
  _config = null;
  _actions = null;
  _user.value = null;
  _isAuthenticated.value = false;
  _isLoading.value = true;
  _error.value = null;
  _tokens.value = { access: null, id: null, refresh: null, expiresAt: null };
}

/**
 * Returns the current authentication state and actions.
 * Must be called in a component rendered inside an AuthProvider.
 *
 * @returns Reactive auth state (Kasper signals) and actions.
 * @throws If called before AuthProvider has mounted.
 */
export function useAuth(): AuthContextValue {
  if (!_client || !_config || !_actions) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return {
    config: _config,
    user: _user,
    isAuthenticated: _isAuthenticated,
    isLoading: _isLoading,
    error: _error,
    tokens: _tokens,
    actions: _actions,
  };
}
