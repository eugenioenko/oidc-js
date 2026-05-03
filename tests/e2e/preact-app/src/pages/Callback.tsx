import { useAuth } from "oidc-js-preact";

interface CallbackPageProps {
  path?: string;
}

export function CallbackPage(_props: CallbackPageProps) {
  const { error } = useAuth();
  if (error) {
    return <div data-testid="auth-error">Error: {error.message}</div>;
  }
  return <div data-testid="auth-loading">Processing login...</div>;
}
