import { useEffect, useRef } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { useAuth } from "./context.js";
import type { LoginOptions } from "oidc-js";

interface RequireAuthProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
  autoRefresh?: boolean;
  loginOptions?: LoginOptions;
}

/**
 * Auth guard component that protects its children behind authentication.
 *
 * If the user is not authenticated, it attempts a silent token refresh (when `autoRefresh`
 * is enabled and a refresh token exists). If refresh fails or is disabled, it redirects
 * to the login page. While loading or refreshing, it renders the optional `fallback`.
 *
 * @param props - Guard configuration including children, fallback UI, and login options.
 */
export function RequireAuth({
  children,
  fallback = null,
  autoRefresh = true,
  loginOptions,
}: RequireAuthProps) {
  const { isAuthenticated, isLoading, tokens, actions } = useAuth();
  const refreshAttempted = useRef(false);

  const isExpired = tokens.expiresAt !== null && tokens.expiresAt <= Date.now();
  const needsAuth = !isAuthenticated || isExpired;

  useEffect(() => {
    if (!needsAuth) {
      refreshAttempted.current = false;
      return;
    }
    if (isLoading) return;

    if (autoRefresh && !refreshAttempted.current) {
      refreshAttempted.current = true;
      actions.refresh().catch(() => actions.login(loginOptions));
      return;
    }

    actions.login(loginOptions);
  }, [isLoading, needsAuth, autoRefresh, actions, loginOptions]);

  if (isLoading || needsAuth) {
    return fallback;
  }

  return children;
}
