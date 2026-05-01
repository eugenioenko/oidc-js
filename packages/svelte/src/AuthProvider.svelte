<!--
  @component
  Provides OIDC authentication context to all child components.

  Wraps the application (or a subtree) and manages the full OIDC lifecycle:
  discovery, callback handling, token management, and logout.

  Uses `setContext()` internally so that child components can call
  `getAuthContext()` to access reactive auth state and actions.

  @example
  ```svelte
  <AuthProvider config={oidcConfig}>
    <App />
  </AuthProvider>
  ```
-->
<script lang="ts">
  import type { OidcConfig } from "oidc-js-core";
  import type { Snippet } from "svelte";
  import { onDestroy } from "svelte";
  import { AuthStateManager, setAuthContext } from "./context.svelte.js";

  interface Props {
    /** OIDC configuration including issuer, clientId, and redirectUri. */
    config: OidcConfig;
    /** Whether to fetch the userinfo profile after token exchange. Defaults to true. */
    fetchProfile?: boolean;
    /** Callback invoked after a successful login with the returnTo path. */
    onLogin?: (returnTo: string) => void;
    /** Callback invoked when an authentication error occurs. */
    onError?: (error: Error) => void;
    /** Child content to render. */
    children: Snippet;
  }

  let { config, fetchProfile = true, onLogin, onError, children }: Props = $props();

  const manager = new AuthStateManager(config, fetchProfile);
  setAuthContext(manager);

  const unsub = manager.client.subscribe((state) => {
    manager.update(state);
  });

  manager.client.init().then(({ returnTo }) => {
    const s = manager.client.state;
    if (s.error && onError) onError(s.error);
    if (returnTo) {
      if (onLogin) {
        onLogin(returnTo);
      } else {
        window.history.replaceState({}, "", returnTo);
      }
    }
  });

  onDestroy(() => {
    unsub();
    manager.client.destroy();
  });
</script>

{@render children()}
