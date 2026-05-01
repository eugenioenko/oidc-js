import { useState, useEffect } from "react";
import { useAuth, RequireAuth } from "oidc-js-react";

function HomePage() {
  const { user, isAuthenticated, isLoading, error, tokens, actions } = useAuth();

  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  if (error) {
    return <div data-testid="error">Error: {error.message}</div>;
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
      <div data-testid="id-token">{tokens.id ? "present" : "missing"}</div>
      <div data-testid="expires-at">{tokens.expiresAt ?? "none"}</div>
      <button data-testid="logout-button" onClick={() => actions.logout()}>
        Logout
      </button>
      <button data-testid="refresh-button" onClick={() => actions.refresh().catch(() => {})}>
        Refresh
      </button>
    </div>
  );
}

function ProtectedPage({ name }: { name: string }) {
  return (
    <RequireAuth fallback={<div data-testid="require-auth-loading">Refreshing...</div>}>
      <div data-testid={`protected-${name}`}>
        Protected content {name}
      </div>
    </RequireAuth>
  );
}

export function App() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  switch (hash) {
    case "#/protected-a":
      return <ProtectedPage name="a" />;
    case "#/protected-b":
      return <ProtectedPage name="b" />;
    default:
      return <HomePage />;
  }
}
