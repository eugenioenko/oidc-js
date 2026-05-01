import { RequireAuth } from "oidc-js-preact";

interface ProtectedBProps {
  path?: string;
}

export function ProtectedB(_props: ProtectedBProps) {
  return (
    <RequireAuth fallback={<div data-testid="auth-loading">Refreshing...</div>}>
      <div data-testid="protected-b">
        Protected content B
      </div>
      <nav>
        <a data-testid="link-home" href="/">Home</a>
        <a data-testid="link-protected-a" href="/protected-a">Protected A</a>
        <a data-testid="link-protected-b" href="/protected-b">Protected B</a>
      </nav>
    </RequireAuth>
  );
}
