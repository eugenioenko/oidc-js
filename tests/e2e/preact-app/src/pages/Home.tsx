import { useAuth } from "oidc-js-preact";

interface HomePageProps {
  path?: string;
}

export function HomePage(_props: HomePageProps) {
  const { user, isAuthenticated, isLoading, error, tokens, actions } = useAuth();

  if (isLoading) {
    return <div data-testid="auth-loading">Loading...</div>;
  }

  if (error) {
    return <div data-testid="auth-error">Error: {error.message}</div>;
  }

  if (!isAuthenticated) {
    return (
      <div data-testid="unauthenticated">
        <h1>Not logged in</h1>
        <button data-testid="login-button" onClick={() => actions.login()}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div data-testid="authenticated">
      <h1>Logged in</h1>
      <div data-testid="user-sub">{user?.claims.sub}</div>
      <div data-testid="user-iss">{user?.claims.iss}</div>
      <div data-testid="user-aud">{typeof user?.claims.aud === "string" ? user.claims.aud : JSON.stringify(user?.claims.aud)}</div>
      <div data-testid="user-exp">{user?.claims.exp}</div>
      <div data-testid="user-iat">{user?.claims.iat}</div>
      <div data-testid="user-email">{user?.profile?.email ?? "no profile"}</div>
      <div data-testid="user-profile-null">{user?.profile === null ? "true" : "false"}</div>
      <div data-testid="access-token">{tokens.access ? "present" : "missing"}</div>
      <div data-testid="refresh-token">{tokens.refresh ? "present" : "missing"}</div>
      <div data-testid="access-token-value" style={{ display: "none" }}>{tokens.access ?? ""}</div>
      <div data-testid="refresh-token-value" style={{ display: "none" }}>{tokens.refresh ?? ""}</div>
      <div data-testid="id-token">{tokens.id ? "present" : "missing"}</div>
      <div data-testid="expires-at">{tokens.expiresAt ?? "none"}</div>
      <button data-testid="logout-button" onClick={() => actions.logout()}>
        Logout
      </button>
      <button data-testid="refresh-button" onClick={() => actions.refresh().catch(() => {})}>
        Refresh
      </button>
      <button data-testid="fetch-profile-button" onClick={() => actions.fetchProfile().catch(() => {})}>
        Fetch Profile
      </button>
      <nav>
        <a data-testid="link-protected-a" href="/protected-a">Protected A</a>
        <a data-testid="link-protected-b" href="/protected-b">Protected B</a>
      </nav>
    </div>
  );
}
