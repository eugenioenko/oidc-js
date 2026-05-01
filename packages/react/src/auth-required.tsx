import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import { useAuth } from "./context.js";

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
  autoRefresh?: boolean;
}

export function RequireAuth({
  children,
  fallback = null,
  autoRefresh = true,
}: RequireAuthProps) {
  const { isAuthenticated, isLoading, tokens, actions } = useAuth();
  const refreshAttempted = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const effectivelyAuthenticated = useMemo(
    () => isAuthenticated && (tokens.expiresAt === null || tokens.expiresAt > Date.now()),
    [isAuthenticated, tokens.expiresAt],
  );

  useEffect(() => {
    if (effectivelyAuthenticated) {
      refreshAttempted.current = false;
    }
  }, [effectivelyAuthenticated]);

  useEffect(() => {
    if (isLoading || effectivelyAuthenticated || refreshing) return;

    if (autoRefresh && !refreshAttempted.current) {
      refreshAttempted.current = true;
      setRefreshing(true);
      actions
        .refresh()
        .catch(() => {})
        .finally(() => setRefreshing(false));
      return;
    }

    actions.login();
  }, [isLoading, effectivelyAuthenticated, refreshing, autoRefresh, actions]);

  if (isLoading || refreshing || !effectivelyAuthenticated) {
    return fallback;
  }

  return children;
}
