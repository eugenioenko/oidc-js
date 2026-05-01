import { RequireAuth } from "oidc-js-preact";

interface ProtectedAProps {
  path?: string;
}

export function ProtectedA(_props: ProtectedAProps) {
  return (
    <RequireAuth fallback={<div data-testid="auth-loading">Refreshing...</div>}>
      <div data-testid="protected-a">
        Protected content A
      </div>
      <nav>
        <a data-testid="link-home" href="/">Home</a>
        <a data-testid="link-protected-a" href="/protected-a">Protected A</a>
        <a data-testid="link-protected-b" href="/protected-b">Protected B</a>
      </nav>
    </RequireAuth>
  );
}
