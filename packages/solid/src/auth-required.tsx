import { Show, createEffect, type JSX, type ParentComponent } from "solid-js";
import { useAuth } from "./context.js";
import type { LoginOptions } from "oidc-js";
import { isExpiredAt } from "oidc-js-core";

/**
 * Props for the {@link RequireAuth} component.
 */
interface RequireAuthProps {
  /** Content to display while loading or when not authenticated. */
  fallback?: JSX.Element;
  /** Whether to automatically refresh an expired token before redirecting to login. Defaults to true. */
  autoRefresh?: boolean;
  /** Additional options passed to the login redirect. */
  loginOptions?: LoginOptions;
  /** Buffer in milliseconds before token expiry to consider it expired. Defaults to 30000. */
  tokenExpirationBuffer?: number;
}

/**
 * SolidJS component guard that only renders children when the user is authenticated.
 *
 * If the user's access token is expired, it attempts a silent refresh first.
 * If the refresh fails (or no refresh token exists), it redirects to the login page.
 *
 * @example
 * ```tsx
 * <RequireAuth fallback={<div>Loading...</div>}>
 *   <ProtectedContent />
 * </RequireAuth>
 * ```
 */
export const RequireAuth: ParentComponent<RequireAuthProps> = (props) => {
  const auth = useAuth();
  let refreshAttempted = false;

  createEffect(() => {
    const isExpired = isExpiredAt(auth.tokens.expiresAt, props.tokenExpirationBuffer);
    const needsAuth = !auth.isAuthenticated || isExpired;

    if (!needsAuth) {
      refreshAttempted = false;
      return;
    }
    if (auth.isLoading) return;

    const autoRefresh = props.autoRefresh ?? true;

    if (autoRefresh && !refreshAttempted) {
      refreshAttempted = true;
      auth.actions.refresh().catch(() => auth.actions.login(props.loginOptions));
      return;
    }

    auth.actions.login(props.loginOptions);
  });

  return (
    <Show
      when={!auth.isLoading && auth.isAuthenticated && !isExpiredAt(auth.tokens.expiresAt, props.tokenExpirationBuffer)}
      fallback={props.fallback}
    >
      {props.children}
    </Show>
  );
};
