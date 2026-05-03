<script lang="ts">
  import { getAuthContext } from "oidc-js-svelte";

  interface Props {
    navigate: (to: string) => void;
  }

  let { navigate }: Props = $props();

  const auth = getAuthContext();

  function goTo(e: MouseEvent, path: string) {
    e.preventDefault();
    navigate(path);
  }
</script>

{#if auth.isLoading}
  <div data-testid="auth-loading">Loading...</div>
{:else if auth.error}
  <div data-testid="auth-error">Error: {auth.error.message}</div>
{:else if !auth.isAuthenticated}
  <div data-testid="unauthenticated">
    <h1>Not logged in</h1>
    <button data-testid="login-button" onclick={() => auth.actions.login()}>
      Login
    </button>
  </div>
{:else}
  <div data-testid="authenticated">
    <h1>Logged in</h1>
    <div data-testid="user-sub">{auth.user?.claims.sub}</div>
    <div data-testid="user-iss">{auth.user?.claims.iss}</div>
    <div data-testid="user-aud">{typeof auth.user?.claims.aud === "string" ? auth.user.claims.aud : JSON.stringify(auth.user?.claims.aud)}</div>
    <div data-testid="user-exp">{auth.user?.claims.exp}</div>
    <div data-testid="user-iat">{auth.user?.claims.iat}</div>
    <div data-testid="user-email">{auth.user?.profile?.email ?? "no profile"}</div>
    <div data-testid="user-profile-null">{auth.user?.profile === null ? "true" : "false"}</div>
    <div data-testid="access-token">{auth.tokens.access ? "present" : "missing"}</div>
    <div data-testid="refresh-token">{auth.tokens.refresh ? "present" : "missing"}</div>
    <div data-testid="access-token-value" style="display: none">{auth.tokens.access ?? ""}</div>
    <div data-testid="refresh-token-value" style="display: none">{auth.tokens.refresh ?? ""}</div>
    <div data-testid="id-token">{auth.tokens.id ? "present" : "missing"}</div>
    <div data-testid="expires-at">{auth.tokens.expiresAt ?? "none"}</div>
    <button data-testid="logout-button" onclick={() => auth.actions.logout()}>
      Logout
    </button>
    <button data-testid="refresh-button" onclick={() => auth.actions.refresh().catch(() => {})}>
      Refresh
    </button>
    <button data-testid="fetch-profile-button" onclick={() => auth.actions.fetchProfile().catch(() => {})}>
      Fetch Profile
    </button>
    <nav>
      <a href="/protected-a" data-testid="link-protected-a" onclick={(e) => goTo(e, "/protected-a")}>Protected A</a>
      <a href="/protected-b" data-testid="link-protected-b" onclick={(e) => goTo(e, "/protected-b")}>Protected B</a>
    </nav>
  </div>
{/if}
