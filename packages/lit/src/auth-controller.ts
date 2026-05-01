import type { ReactiveController, ReactiveControllerHost } from "lit";
import { OidcClient, type AuthState, type AuthUser, type AuthTokens, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthControllerOptions } from "./types.js";

/**
 * A Lit {@link ReactiveController} that manages OIDC authentication state.
 *
 * Wraps {@link OidcClient} and integrates with Lit's reactive update lifecycle.
 * When the authentication state changes, the controller calls `host.requestUpdate()`
 * to trigger a re-render of the host element.
 *
 * @example
 * ```ts
 * import { LitElement, html } from 'lit';
 * import { AuthController } from 'oidc-js-lit';
 *
 * class MyApp extends LitElement {
 *   private auth = new AuthController(this, {
 *     config: {
 *       issuer: 'https://example.com',
 *       clientId: 'my-app',
 *       redirectUri: 'http://localhost:3000/callback',
 *       scopes: ['openid', 'profile'],
 *     },
 *   });
 *
 *   render() {
 *     if (this.auth.isLoading) return html`<p>Loading...</p>`;
 *     if (!this.auth.isAuthenticated) return html`<button @click=${() => this.auth.login()}>Login</button>`;
 *     return html`<p>Hello, ${this.auth.user?.claims.sub}</p>`;
 *   }
 * }
 * ```
 */
export class AuthController implements ReactiveController {
  private host: ReactiveControllerHost;
  private client: OidcClient | null = null;
  private unsubscribe: (() => void) | null = null;
  private options: AuthControllerOptions;

  private _state: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    tokens: { access: null, id: null, refresh: null, expiresAt: null },
  };

  /**
   * Creates a new AuthController and registers it with the host element.
   *
   * @param host - The Lit element that owns this controller.
   * @param options - OIDC configuration and optional callbacks.
   */
  constructor(host: ReactiveControllerHost, options: AuthControllerOptions) {
    this.host = host;
    this.options = options;
    host.addController(this);
  }

  /** The authenticated user, or null if not logged in. */
  get user(): AuthUser | null {
    return this._state.user;
  }

  /** Whether the user is currently authenticated. */
  get isAuthenticated(): boolean {
    return this._state.isAuthenticated;
  }

  /** Whether initialization or a token exchange is in progress. */
  get isLoading(): boolean {
    return this._state.isLoading;
  }

  /** The most recent authentication error, or null if none. */
  get error(): Error | null {
    return this._state.error;
  }

  /** Current set of OAuth 2.0 tokens. */
  get tokens(): AuthTokens {
    return this._state.tokens;
  }

  /** The OIDC configuration passed to this controller. */
  get config(): OidcConfig {
    return this.options.config;
  }

  /**
   * Called when the host element is connected to the DOM.
   * Creates the {@link OidcClient}, subscribes to state changes, and initializes the OIDC flow.
   */
  hostConnected(): void {
    const { config, fetchProfile, onLogin, onError } = this.options;
    const client = new OidcClient({ ...config, fetchProfile });
    this.client = client;

    this.unsubscribe = client.subscribe((state: AuthState) => {
      this._state = state;
      this.host.requestUpdate();
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
  }

  /**
   * Called when the host element is disconnected from the DOM.
   * Cleans up the subscription and destroys the client.
   */
  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.client?.destroy();
    this.client = null;
  }

  /**
   * Starts the Authorization Code + PKCE login flow by redirecting to the authorization endpoint.
   *
   * @param options - Optional login parameters such as `returnTo` and `extraParams`.
   */
  async login(options?: LoginOptions): Promise<void> {
    await this.client?.login(options);
  }

  /**
   * Logs the user out by clearing local state and redirecting to the OP's end-session endpoint.
   */
  logout(): void {
    this.client?.logout();
  }

  /**
   * Uses the stored refresh token to obtain a new set of tokens.
   *
   * @throws Error if no refresh token is available or discovery has not been fetched.
   */
  async refresh(): Promise<void> {
    await this.client?.refresh();
  }

  /**
   * Fetches the user's profile from the userinfo endpoint using the current access token.
   *
   * @throws Error if no access token is available or discovery has not been fetched.
   */
  async fetchProfile(): Promise<void> {
    await this.client?.fetchProfile();
  }
}
