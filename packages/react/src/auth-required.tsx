import { type ReactNode } from "react";
import { useAuth } from "./context.js";

interface AuthRequiredProps {
  children: ReactNode;
  fallback?: ReactNode;
  loginOnUnauth?: boolean;
}

export function AuthRequired({
  children,
  fallback,
  loginOnUnauth = true,
}: AuthRequiredProps) {
  const { isAuthenticated, isLoading, login } = useAuth();

  if (isLoading) {
    return fallback ?? null;
  }

  if (!isAuthenticated) {
    if (loginOnUnauth) {
      login();
    }
    return fallback ?? null;
  }

  return children;
}
