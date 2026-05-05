import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "./context.js";
import type { LoginOptions } from "oidc-js";
import { isExpiredAt } from "oidc-js-core";

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
  autoRefresh?: boolean;
  loginOptions?: LoginOptions;
}

export function RequireAuth({
  children,
  fallback = null,
  autoRefresh = true,
  loginOptions,
}: RequireAuthProps) {
  const { isAuthenticated, isLoading, tokens, actions, config } = useAuth();
  const refreshAttempted = useRef(false);

  const isExpired = isExpiredAt(tokens.expiresAt, config.expiryBuffer);
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
