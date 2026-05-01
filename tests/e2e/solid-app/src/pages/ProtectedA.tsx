import { A } from "@solidjs/router";
import { RequireAuth } from "oidc-js-solid";

export function ProtectedA() {
  return (
    <RequireAuth fallback={<div data-testid="auth-loading">Refreshing...</div>}>
      <div data-testid="protected-a">Protected content a</div>
      <nav>
        <A data-testid="link-home" href="/">
          Home
        </A>
        <A data-testid="link-protected-a" href="/protected-a">
          Protected A
        </A>
        <A data-testid="link-protected-b" href="/protected-b">
          Protected B
        </A>
      </nav>
    </RequireAuth>
  );
}
