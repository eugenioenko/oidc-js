import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "./context.js";
import type { LoginOptions } from "oidc-js";
import { isExpiredAt } from "oidc-js-core";

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
  autoRefresh?: boolean;
  loginOptions?: LoginOptions;
  tokenExpirationBuffer?: number;
}

export function RequireAuth({
  children,
  fallback = null,
  autoRefresh = true,
  loginOptions,
  tokenExpirationBuffer,
}: RequireAuthProps) {
  const { isAuthenticated, isLoading, tokens, actions } = useAuth();
  const refreshAttempted = useRef(false);

  const isExpired = isExpiredAt(tokens.expiresAt, tokenExpirationBuffer);
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
