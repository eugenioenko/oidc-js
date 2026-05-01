import { getContext, setContext } from "svelte";
import { OidcClient, type AuthState, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthContextValue, AuthActions } from "./types.js";

const AUTH_CONTEXT_KEY = Symbol("oidc-js-auth");

/**
 * Reactive authentication state container using Svelte 5 runes.
 *
 * Created internally by {@link AuthProvider} and shared via Svelte's context API.
 * Consumers access it through {@link getAuthContext}.
 */
export class AuthStateManager {
  private _user: AuthState["user"] = $state(null);
  private _isAuthenticated: boolean = $state(false);
  private _isLoading: boolean = $state(true);
  private _error: AuthState["error"] = $state(null);
  private _tokens: AuthState["tokens"] = $state({
    access: null,
    id: null,
    refresh: null,
    expiresAt: null,
  });

  readonly config: OidcConfig;
  readonly client: OidcClient;
  readonly actions: AuthActions;

  constructor(config: OidcConfig, fetchProfile: boolean) {
    this.config = config;
    this.client = new OidcClient({ ...config, fetchProfile });

    this.actions = {
      login: (options?: LoginOptions) => {
        this.client.login(options);
      },
      logout: () => {
        this.client.logout();
      },
      refresh: () => this.client.refresh(),
      fetchProfile: () => this.client.fetchProfile(),
    };
  }

  /** Updates the reactive state from an {@link AuthState} snapshot. */
  update(state: AuthState): void {
    this._user = state.user;
    this._isAuthenticated = state.isAuthenticated;
    this._isLoading = state.isLoading;
    this._error = state.error;
    this._tokens = state.tokens;
  }

  get user() { return this._user; }
  get isAuthenticated() { return this._isAuthenticated; }
  get isLoading() { return this._isLoading; }
  get error() { return this._error; }
  get tokens() { return this._tokens; }
}

/**
 * Sets the auth context value for child components.
 *
 * Called internally by the AuthProvider component.
 *
 * @param manager - The reactive auth state manager.
 */
export function setAuthContext(manager: AuthStateManager): void {
  setContext(AUTH_CONTEXT_KEY, manager);
}

/**
 * Retrieves the authentication context from the nearest {@link AuthProvider} ancestor.
 *
 * Must be called during component initialization (not inside event handlers or async callbacks).
 *
 * @returns The reactive authentication context value.
 * @throws Error if called outside of an AuthProvider.
 */
export function getAuthContext(): AuthContextValue {
  const manager = getContext<AuthStateManager | undefined>(AUTH_CONTEXT_KEY);
  if (!manager) {
    throw new Error("getAuthContext must be used within an AuthProvider");
  }

  return {
    get config() { return manager.config; },
    get user() { return manager.user; },
    get isAuthenticated() { return manager.isAuthenticated; },
    get isLoading() { return manager.isLoading; },
    get error() { return manager.error; },
    get tokens() { return manager.tokens; },
    get actions() { return manager.actions; },
  };
}
