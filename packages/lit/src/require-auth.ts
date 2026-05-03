import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { AuthController } from "./auth-controller.js";
import type { LoginOptions } from "oidc-js";
import { isExpiredAt } from "oidc-js-core";

/**
 * Options for the {@link RequireAuthController}.
 */
export interface RequireAuthOptions {
  /** The {@link AuthController} instance to observe for authentication state. */
  auth: AuthController;
  /** Whether to attempt a silent token refresh before redirecting to login. Defaults to true. */
  autoRefresh?: boolean;
  /** Additional options passed to the login redirect if authentication is required. */
  loginOptions?: LoginOptions;
  /** Buffer in milliseconds before token expiry to consider it expired. Defaults to 30000. */
  tokenExpirationBuffer?: number;
}

/**
 * A Lit {@link ReactiveController} that guards content behind authentication.
 *
 * Observes an {@link AuthController} and determines whether the user is authorized
 * to view protected content. If the access token is expired, it attempts a silent
 * refresh (when `autoRefresh` is enabled). If refresh fails or no refresh token
 * exists, it triggers a login redirect.
 *
 * Use the {@link authorized} property in the host's `render()` method to conditionally
 * display protected content.
 *
 * @example
 * ```ts
 * import { LitElement, html } from 'lit';
 * import { AuthController, RequireAuthController } from 'oidc-js-lit';
 *
 * class ProtectedPage extends LitElement {
 *   private auth: AuthController;
 *   private guard: RequireAuthController;
 *
 *   constructor(auth: AuthController) {
 *     super();
 *     this.auth = auth;
 *     this.guard = new RequireAuthController(this, { auth });
 *   }
 *
 *   render() {
 *     if (!this.guard.authorized) return html`<p>Loading...</p>`;
 *     return html`<p>Protected content</p>`;
 *   }
 * }
 * ```
 */
export class RequireAuthController implements ReactiveController {
  private host: ReactiveControllerHost;
  private auth: AuthController;
  private autoRefresh: boolean;
  private loginOptions?: LoginOptions;
  private tokenExpirationBuffer?: number;
  private refreshAttempted = false;

  /**
   * Creates a new RequireAuthController and registers it with the host element.
   *
   * @param host - The Lit element that owns this controller.
   * @param options - Configuration including the auth controller reference.
   */
  constructor(host: ReactiveControllerHost, options: RequireAuthOptions) {
    this.host = host;
    this.auth = options.auth;
    this.autoRefresh = options.autoRefresh ?? true;
    this.loginOptions = options.loginOptions;
    this.tokenExpirationBuffer = options.tokenExpirationBuffer;
    host.addController(this);
  }

  /**
   * Whether the user is authorized to view protected content.
   * Returns `true` only when the user is authenticated and tokens are not expired.
   */
  get authorized(): boolean {
    const { isAuthenticated, isLoading, tokens } = this.auth;
    const isExpired = isExpiredAt(tokens.expiresAt, this.tokenExpirationBuffer);
    return isAuthenticated && !isExpired && !isLoading;
  }

  /** @internal */
  hostConnected(): void {
    // No-op: state comes from the AuthController
  }

  /** @internal */
  hostDisconnected(): void {
    this.refreshAttempted = false;
  }

  /**
   * Called after the host updates. Checks authentication state and triggers
   * refresh or login as needed.
   */
  hostUpdated(): void {
    const { isAuthenticated, isLoading, tokens } = this.auth;
    const isExpired = isExpiredAt(tokens.expiresAt, this.tokenExpirationBuffer);
    const needsAuth = !isAuthenticated || isExpired;

    if (!needsAuth) {
      this.refreshAttempted = false;
      return;
    }

    if (isLoading) return;

    if (this.autoRefresh && !this.refreshAttempted) {
      this.refreshAttempted = true;
      this.auth.refresh().catch(() => this.auth.login(this.loginOptions));
      return;
    }

    this.auth.login(this.loginOptions);
  }
}
