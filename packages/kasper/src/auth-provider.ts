import { Component } from "kasper-js";
import type { OidcConfig } from "oidc-js-core";
import type { OidcClient } from "oidc-js";
import { _initAuth, _destroyAuth } from "./context.js";

interface AuthProviderArgs {
  config: OidcConfig;
  fetchProfile?: boolean;
  onLogin?: (returnTo: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Wraps the application and provides OIDC authentication state.
 * Register as a tag in the Kasper registry and pass config via args.
 *
 * @example
 * ```html
 * <auth-provider @:config="config" @:onLogin="handleLogin">
 *   <app-content />
 * </auth-provider>
 * ```
 */
export class AuthProvider extends Component<AuthProviderArgs> {
  static template = "<slot />";

  private _unsub: (() => void) | null = null;
  private _client: OidcClient | null = null;

  onMount(): void {
    const config = this.args.config;
    const fetchProfile = this.args.fetchProfile ?? true;
    const onLogin = this.args.onLogin;
    const onError = this.args.onError;

    const { client, unsub } = _initAuth(config, fetchProfile);
    this._client = client;
    this._unsub = unsub;

    client.init().then(({ returnTo }) => {
      const s = client.state;
      if (s.error && onError) onError(s.error);
      if (returnTo) {
        if (onLogin) {
          onLogin(returnTo);
        } else {
          window.history.replaceState({}, "", returnTo);
        }
      }
    });
  }

  onDestroy(): void {
    this._unsub?.();
    this._client?.destroy();
    _destroyAuth();
  }
}
