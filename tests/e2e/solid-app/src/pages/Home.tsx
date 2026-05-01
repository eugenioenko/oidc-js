import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { useAuth } from "oidc-js-solid";

export function HomePage() {
  const auth = useAuth();

  return (
    <Show
      when={!auth.isLoading}
      fallback={<div data-testid="auth-loading">Loading...</div>}
    >
      <Show when={auth.error}>
        <div data-testid="auth-error">Error: {auth.error!.message}</div>
      </Show>
      <Show when={!auth.error && !auth.isAuthenticated}>
        <div data-testid="unauthenticated">
          <h1>Not logged in</h1>
          <button data-testid="login-button" onClick={() => auth.actions.login()}>
            Login
          </button>
        </div>
      </Show>
      <Show when={!auth.error && auth.isAuthenticated}>
        <div data-testid="authenticated">
          <h1>Logged in</h1>
          <div data-testid="user-sub">{auth.user?.claims.sub}</div>
          <div data-testid="user-iss">{auth.user?.claims.iss}</div>
          <div data-testid="user-aud">
            {typeof auth.user?.claims.aud === "string"
              ? auth.user.claims.aud
              : JSON.stringify(auth.user?.claims.aud)}
          </div>
          <div data-testid="user-exp">{auth.user?.claims.exp}</div>
          <div data-testid="user-iat">{auth.user?.claims.iat}</div>
          <div data-testid="user-email">
            {auth.user?.profile?.email ?? "no profile"}
          </div>
          <div data-testid="user-profile-null">
            {auth.user?.profile === null ? "true" : "false"}
          </div>
          <div data-testid="access-token">
            {auth.tokens.access ? "present" : "missing"}
          </div>
          <div data-testid="refresh-token">
            {auth.tokens.refresh ? "present" : "missing"}
          </div>
          <div data-testid="access-token-value" style={{ display: "none" }}>
            {auth.tokens.access ?? ""}
          </div>
          <div data-testid="refresh-token-value" style={{ display: "none" }}>
            {auth.tokens.refresh ?? ""}
          </div>
          <div data-testid="id-token">
            {auth.tokens.id ? "present" : "missing"}
          </div>
          <div data-testid="expires-at">{auth.tokens.expiresAt ?? "none"}</div>
          <button data-testid="logout-button" onClick={() => auth.actions.logout()}>
            Logout
          </button>
          <button
            data-testid="refresh-button"
            onClick={() => auth.actions.refresh().catch(() => {})}
          >
            Refresh
          </button>
          <nav>
            <A data-testid="link-protected-a" href="/protected-a">
              Protected A
            </A>
            <A data-testid="link-protected-b" href="/protected-b">
              Protected B
            </A>
          </nav>
        </div>
      </Show>
    </Show>
  );
}
