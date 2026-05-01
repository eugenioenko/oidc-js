import { useEffect, useRef, useState, type ReactNode } from "react";
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
  const { isAuthenticated, isLoading, actions } = useAuth();
  const refreshAttempted = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAttempted.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading || isAuthenticated || refreshing) return;

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
  }, [isLoading, isAuthenticated, refreshing, autoRefresh, actions]);

  if (isLoading || refreshing || !isAuthenticated) {
    return fallback;
  }

  return children;
}
