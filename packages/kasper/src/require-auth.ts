import { Component } from "kasper-js";
import type { LoginOptions } from "oidc-js";
import { isExpiredAt } from "oidc-js-core";
import { useAuth } from "./context.js";

interface RequireAuthArgs {
  autoRefresh?: boolean;
  loginOptions?: LoginOptions;
  tokenExpirationBuffer?: number;
}

/**
 * Guard component that only renders its default slot when the user is authenticated.
 * Shows the "fallback" named slot while loading or redirecting.
 *
 * @example
 * ```html
 * <require-auth>
 *   <div @slot="fallback">Loading...</div>
 *   <protected-content />
 * </require-auth>
 * ```
 */
export class RequireAuth extends Component<RequireAuthArgs> {
  static template =
    '<span @if="!_ready()"><slot @name="fallback" /></span>' +
    '<span @else><slot /></span>';

  private _refreshAttempted = false;

  _ready(): boolean {
    const auth = useAuth();
    const isExpired = isExpiredAt(auth.tokens.value.expiresAt, this.args.tokenExpirationBuffer);
    return (
      !auth.isLoading.value && auth.isAuthenticated.value && !isExpired
    );
  }

  onMount(): void {
    const auth = useAuth();
    const autoRefresh = this.args.autoRefresh ?? true;

    this.effect(() => {
      const isExpired = isExpiredAt(auth.tokens.value.expiresAt, this.args.tokenExpirationBuffer);
      const needsAuth = !auth.isAuthenticated.value || isExpired;

      if (!needsAuth) {
        this._refreshAttempted = false;
        return;
      }
      if (auth.isLoading.value) return;

      if (autoRefresh && !this._refreshAttempted) {
        this._refreshAttempted = true;
        auth.actions
          .refresh()
          .catch(() => auth.actions.login(this.args.loginOptions));
        return;
      }
      auth.actions.login(this.args.loginOptions);
    });
  }
}
