<script lang="ts">
  import { AuthProvider } from "oidc-js-svelte";
  import Home from "./routes/Home.svelte";
  import Callback from "./routes/Callback.svelte";
  import ProtectedA from "./routes/ProtectedA.svelte";
  import ProtectedB from "./routes/ProtectedB.svelte";

  const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";

  const config = {
    issuer: "http://localhost:9999/oauth2",
    clientId: "e2e-test-app",
    redirectUri: "http://localhost:5173/callback",
    scopes: ["openid", "profile", "email", "offline_access"],
    postLogoutRedirectUri: "http://localhost:5173",
  };

  let path = $state(window.location.pathname);

  function navigate(to: string) {
    window.history.pushState({}, "", to);
    path = to;
  }

  function handleLogin(returnTo: string) {
    window.history.replaceState({}, "", returnTo);
    path = returnTo;
  }

  $effect(() => {
    function onPopState() {
      path = window.location.pathname;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  });
</script>

<AuthProvider {config} {fetchProfile} onLogin={handleLogin}>
  {#snippet children()}
    {#if path === "/callback"}
      <Callback />
    {:else if path === "/protected-a"}
      <ProtectedA {navigate} />
    {:else if path === "/protected-b"}
      <ProtectedB {navigate} />
    {:else}
      <Home {navigate} />
    {/if}
  {/snippet}
</AuthProvider>
