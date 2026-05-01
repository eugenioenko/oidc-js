import { useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "./context.js";
import type { LoginOptions } from "oidc-js";

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
  const { isAuthenticated, isLoading, tokens, actions } = useAuth();
  const refreshAttempted = useRef(false);

  const effectivelyAuthenticated =
    isAuthenticated && (tokens.expiresAt === null || tokens.expiresAt > Date.now());

  useEffect(() => {
    if (effectivelyAuthenticated) {
      refreshAttempted.current = false;
    }
  }, [effectivelyAuthenticated]);

  useEffect(() => {
    if (isLoading || effectivelyAuthenticated) return;

    if (autoRefresh && !refreshAttempted.current) {
      refreshAttempted.current = true;
      actions.refresh().catch(() => {
        actions.login(loginOptions);
      });
      return;
    }

    actions.login(loginOptions);
  }, [isLoading, effectivelyAuthenticated, autoRefresh, actions, loginOptions]);

  if (isLoading || !effectivelyAuthenticated) {
    return fallback;
  }

  return children;
}
