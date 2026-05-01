import { OidcClient, type AuthState, type LoginOptions, type AuthTokens, type AuthUser } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";

/**
 * Configuration for the OidcService.
 */
export interface OidcServiceConfig {
  /** Core OIDC configuration including issuer, clientId, and redirectUri. */
  config: OidcConfig;
  /** Whether to automatically fetch the userinfo profile after login. Defaults to true. */
  fetchProfile?: boolean;
  /** Callback invoked after a successful login with the returnTo path. */
  onLogin?: (returnTo: string) => void;
  /** Callback invoked when an authentication error occurs. */
  onError?: (error: Error) => void;
}

/**
 * Standalone OIDC authentication service for Ember.js applications.
 *
 * This service wraps {@link OidcClient} and exposes reactive auth state properties.
 * In Ember Octane apps, properties are updated via assignment, making them compatible
 * with Glimmer's `@tracked` when the service is registered in Ember's DI container
 * via `createOidcService`.
 *
 * Can also be used standalone outside of Ember's service layer.
 *
 * @example
 * ```typescript
 * import { OidcService } from 'oidc-js-ember';
 *
 * const service = new OidcService({
 *   config: { issuer: '...', clientId: '...', redirectUri: '...' },
 *   onLogin: (returnTo) => router.transitionTo(returnTo),
 * });
 * await service.setup();
 * ```
 */
export class OidcService {
  /** The current authenticated user, or null if not logged in. */
  user: AuthUser | null = null;

  /** Whether the user is currently authenticated. */
  isAuthenticated = false;

  /** Whether initialization or a token exchange is in progress. */
  isLoading = true;

  /** The most recent authentication error, or null if none. */
  error: Error | null = null;

  /** Current set of OAuth 2.0 tokens. */
  tokens: AuthTokens = { access: null, id: null, refresh: null, expiresAt: null };

  /** The OIDC configuration passed at construction time. */
  readonly oidcConfig: OidcConfig;

  private client: OidcClient;
  private unsub: (() => void) | null = null;
  private onLoginCallback?: (returnTo: string) => void;
  private onErrorCallback?: (error: Error) => void;
  private listeners = new Set<() => void>();

  /**
   * Creates a new OidcService instance.
   *
   * @param options - Service configuration including OIDC config and callbacks.
   */
  constructor(options: OidcServiceConfig) {
    this.oidcConfig = options.config;
    this.onLoginCallback = options.onLogin;
    this.onErrorCallback = options.onError;

    this.client = new OidcClient({
      ...options.config,
      fetchProfile: options.fetchProfile,
    });
  }

  /**
   * Initializes the OIDC client by fetching discovery and processing any callback parameters.
   *
   * Call this method once during application startup (e.g., in the application route's
   * `beforeModel` hook or the application instance initializer).
   *
   * @returns A promise that resolves when initialization is complete.
   */
  async setup(): Promise<void> {
    this.unsub = this.client.subscribe((state: AuthState) => {
      this.user = state.user;
      this.isAuthenticated = state.isAuthenticated;
      this.isLoading = state.isLoading;
      this.error = state.error;
      this.tokens = state.tokens;
      for (const fn of this.listeners) fn();
    });

    const { returnTo } = await this.client.init();
    const state = this.client.state;

    if (state.error) {
      this.onErrorCallback?.(state.error);
    }

    if (returnTo) {
      if (this.onLoginCallback) {
        this.onLoginCallback(returnTo);
      } else {
        window.history.replaceState({}, "", returnTo);
      }
    }
  }

  /**
   * Starts the Authorization Code + PKCE login flow.
   *
   * Redirects the browser to the authorization endpoint. The current URL is saved
   * as the `returnTo` destination unless overridden in options.
   *
   * @param options - Optional login parameters such as `returnTo` and `extraParams`.
   */
  async login(options?: LoginOptions): Promise<void> {
    await this.client.login(options);
  }

  /**
   * Logs the user out by clearing local state and redirecting to the OP's end-session endpoint.
   */
  logout(): void {
    this.client.logout();
  }

  /**
   * Refreshes the current token set using the stored refresh token.
   *
   * @throws Error if no refresh token is available.
   */
  async refresh(): Promise<void> {
    await this.client.refresh();
  }

  /**
   * Fetches the user's profile from the userinfo endpoint.
   *
   * @throws Error if no access token is available.
   */
  async fetchProfile(): Promise<void> {
    await this.client.fetchProfile();
  }

  /**
   * Registers a callback that fires whenever the auth state changes.
   *
   * This is useful outside of Ember's `@tracked` reactivity system (e.g., in tests
   * or standalone usage). In Ember, `@tracked` properties auto-notify Glimmer.
   *
   * @param fn - Listener function called on each state change.
   * @returns An unsubscribe function that removes the listener.
   */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /**
   * Tears down the service by aborting in-flight requests and removing subscriptions.
   *
   * Call this when the service is being destroyed (e.g., in Ember's `willDestroy` hook).
   */
  teardown(): void {
    this.unsub?.();
    this.unsub = null;
    this.listeners.clear();
    this.client.destroy();
  }
}

/**
 * Creates an Ember Service subclass that wraps the OIDC authentication logic.
 *
 * This factory function accepts the Ember `Service` base class and `tracked` decorator
 * as parameters, avoiding direct imports of Ember modules at build time. The returned
 * class can be registered in Ember's dependency injection container.
 *
 * @param ServiceBase - The Ember `Service` base class (from `@ember/service`).
 * @param tracked - The `@tracked` decorator (from `@glimmer/tracking`).
 * @returns An Ember Service class with tracked OIDC auth state.
 *
 * @example
 * ```typescript
 * // app/services/oidc.ts
 * import Service from '@ember/service';
 * import { tracked } from '@glimmer/tracking';
 * import { createOidcService } from 'oidc-js-ember';
 *
 * export default createOidcService(Service, tracked);
 * ```
 */
export function createOidcService(
  ServiceBase: abstract new () => object,
  tracked: PropertyDecorator,
): new () => object {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Base = ServiceBase as any;

  class EmberOidcService extends Base {
    user: AuthUser | null = null;
    isAuthenticated = false;
    isLoading = true;
    error: Error | null = null;
    tokens: AuthTokens = { access: null, id: null, refresh: null, expiresAt: null };
    oidcConfig: OidcConfig | null = null;

    private _inner: OidcService | null = null;

    /**
     * Configures and initializes the OIDC service.
     *
     * @param options - Service configuration including OIDC config and callbacks.
     * @returns A promise that resolves when initialization is complete.
     */
    async configure(options: OidcServiceConfig): Promise<void> {
      this.oidcConfig = options.config;

      const inner = new OidcService({
        ...options,
        onLogin: options.onLogin,
        onError: options.onError,
      });
      this._inner = inner;

      // Subscribe to state changes and update tracked properties
      const client = (inner as unknown as Record<string, OidcClient>)["client"];
      const unsub = client.subscribe((state: AuthState) => {
        this.user = state.user;
        this.isAuthenticated = state.isAuthenticated;
        this.isLoading = state.isLoading;
        this.error = state.error;
        this.tokens = state.tokens;
      });
      (inner as unknown as Record<string, (() => void) | null>)["unsub"] = unsub;

      const { returnTo } = await client.init();
      const s = client.state;

      if (s.error) {
        options.onError?.(s.error);
      }

      if (returnTo) {
        if (options.onLogin) {
          options.onLogin(returnTo);
        } else {
          window.history.replaceState({}, "", returnTo);
        }
      }
    }

    /** Starts the Authorization Code + PKCE login flow. */
    async login(options?: LoginOptions): Promise<void> {
      await this._inner?.login(options);
    }

    /** Logs the user out. */
    logout(): void {
      this._inner?.logout();
    }

    /** Refreshes the current token set. */
    async refresh(): Promise<void> {
      await this._inner?.refresh();
    }

    /** Fetches the user's profile from the userinfo endpoint. */
    async fetchProfile(): Promise<void> {
      await this._inner?.fetchProfile();
    }

    willDestroy(): void {
      this._inner?.teardown();
      if (typeof super.willDestroy === "function") {
        super.willDestroy();
      }
    }
  }

  // Apply @tracked to reactive properties
  const proto = EmberOidcService.prototype;
  const trackedKeys = ["user", "isAuthenticated", "isLoading", "error", "tokens", "oidcConfig"];
  for (const key of trackedKeys) {
    tracked(proto, key);
  }

  return EmberOidcService;
}
