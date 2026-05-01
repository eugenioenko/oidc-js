import { Injectable, signal, inject, DestroyRef, InjectionToken } from "@angular/core";
import { Router } from "@angular/router";
import { OidcClient } from "oidc-js";
import type { AuthState, AuthUser, AuthTokens, LoginOptions } from "oidc-js";
import type { AuthProviderOptions } from "./types.js";

/**
 * Injection token for the {@link AuthProviderOptions} configuration.
 *
 * Provided automatically by {@link provideAuth}. Not intended for direct use.
 */
export const AUTH_OPTIONS = new InjectionToken<AuthProviderOptions>("AUTH_OPTIONS");

/**
 * Angular service that manages OIDC authentication state using signals.
 *
 * Wraps {@link OidcClient} and exposes reactive state via Angular signals.
 * Provides methods for login, logout, token refresh, and profile fetching.
 *
 * @example
 * ```typescript
 * const auth = inject(AuthService);
 * if (auth.isAuthenticated()) {
 *   console.log(auth.user()?.claims.sub);
 * }
 * ```
 */
@Injectable()
export class AuthService {
  private client: OidcClient;
  private options: AuthProviderOptions;

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isAuthenticated = signal(false);
  private readonly _isLoading = signal(true);
  private readonly _error = signal<Error | null>(null);
  private readonly _tokens = signal<AuthTokens>({
    access: null,
    id: null,
    refresh: null,
    expiresAt: null,
  });

  /** The authenticated user, or `null` if not logged in. */
  readonly user = this._user.asReadonly();

  /** Whether the user is currently authenticated. */
  readonly isAuthenticated = this._isAuthenticated.asReadonly();

  /** Whether initialization or a token exchange is in progress. */
  readonly isLoading = this._isLoading.asReadonly();

  /** The most recent authentication error, or `null` if none. */
  readonly error = this._error.asReadonly();

  /** Current set of OAuth 2.0 tokens. */
  readonly tokens = this._tokens.asReadonly();

  private router: Router;

  constructor() {
    this.options = inject(AUTH_OPTIONS);
    this.router = inject(Router);
    const destroyRef = inject(DestroyRef);

    this.client = new OidcClient({
      ...this.options.config,
      fetchProfile: this.options.fetchProfile,
    });

    const unsub = this.client.subscribe((state: AuthState) => {
      this._user.set(state.user);
      this._isAuthenticated.set(state.isAuthenticated);
      this._isLoading.set(state.isLoading);
      this._error.set(state.error);
      this._tokens.set(state.tokens);
    });

    destroyRef.onDestroy(() => {
      unsub();
      this.client.destroy();
    });
  }

  /**
   * Initializes the OIDC client by fetching discovery and processing any callback parameters.
   *
   * Called automatically by the `APP_INITIALIZER` provided by {@link provideAuth}.
   * After initialization, if a `returnTo` path is present (from a completed login),
   * it invokes the `onLogin` callback or falls back to Angular's `Router.navigateByUrl`.
   */
  async init(): Promise<void> {
    const { returnTo } = await this.client.init();
    const state = this.client.state;

    if (state.error) {
      this.options.onError?.(state.error);
    }

    if (returnTo) {
      if (this.options.onLogin) {
        this.options.onLogin(returnTo);
      } else {
        this.router.navigateByUrl(returnTo, { replaceUrl: true });
      }
    }
  }

  /**
   * Starts the Authorization Code + PKCE login flow by redirecting to the authorization endpoint.
   *
   * @param options - Optional login parameters such as `returnTo` and `extraParams`.
   */
  async login(options?: LoginOptions): Promise<void> {
    await this.client.login(options);
  }

  /**
   * Logs the user out by clearing local state and redirecting to the end-session endpoint.
   */
  logout(): void {
    this.client.logout();
  }

  /**
   * Uses the stored refresh token to obtain a new set of tokens.
   *
   * @throws Error if no refresh token is available.
   */
  async refresh(): Promise<void> {
    await this.client.refresh();
  }

  /**
   * Fetches the user's profile from the userinfo endpoint using the current access token.
   *
   * @throws Error if no access token is available.
   */
  async fetchProfile(): Promise<void> {
    await this.client.fetchProfile();
  }
}
