import type { Signal } from "kasper-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthUser, AuthTokens, LoginOptions } from "oidc-js";

export type { IdTokenClaims, AuthUser, AuthTokens, LoginOptions } from "oidc-js";
export type { Signal } from "kasper-js";

/** Actions available for controlling authentication flow. */
export interface AuthActions {
  /** Redirects the user to the OIDC provider's authorization endpoint. */
  login: (options?: LoginOptions) => void;
  /** Logs the user out and redirects to the post-logout URI. */
  logout: () => void;
  /** Refreshes the access token using the refresh token. */
  refresh: () => Promise<void>;
  /** Fetches the user's profile from the userinfo endpoint. */
  fetchProfile: () => Promise<void>;
}

/** Value returned by {@link useAuth}. All state properties are Kasper signals. */
export interface AuthContextValue {
  /** The OIDC configuration used to initialize the provider. */
  readonly config: OidcConfig;
  /** The authenticated user, or null if not authenticated. */
  readonly user: Signal<AuthUser | null>;
  /** Whether the user is currently authenticated. */
  readonly isAuthenticated: Signal<boolean>;
  /** Whether the auth state is still being determined. */
  readonly isLoading: Signal<boolean>;
  /** The most recent authentication error, or null. */
  readonly error: Signal<Error | null>;
  /** Current token set (access, id, refresh, expiresAt). */
  readonly tokens: Signal<AuthTokens>;
  /** Actions for login, logout, refresh, and profile fetching. */
  readonly actions: AuthActions;
}
