import { Show, createEffect, type JSX, type ParentComponent } from "solid-js";
import { useAuth } from "./context.js";
import type { LoginOptions } from "oidc-js";

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
  const { isAuthenticated, isLoading, tokens, actions } = useAuth();
  let refreshAttempted = false;

  createEffect(() => {
    const isExpired = tokens.expiresAt !== null && tokens.expiresAt <= Date.now();
    const needsAuth = !isAuthenticated || isExpired;

    if (!needsAuth) {
      refreshAttempted = false;
      return;
    }
    if (isLoading) return;

    const autoRefresh = props.autoRefresh ?? true;

    if (autoRefresh && !refreshAttempted) {
      refreshAttempted = true;
      actions.refresh().catch(() => actions.login(props.loginOptions));
      return;
    }

    actions.login(props.loginOptions);
  });

  return (
    <Show
      when={!isLoading && isAuthenticated && !(tokens.expiresAt !== null && tokens.expiresAt <= Date.now())}
      fallback={props.fallback}
    >
      {props.children}
    </Show>
  );
};
