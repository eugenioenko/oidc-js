<!--
  @component
  Guards child content behind authentication.

  When the user is not authenticated, it attempts to refresh the token.
  If refresh fails or no refresh token exists, it redirects to login.
  While loading or refreshing, it renders the optional `fallback` snippet.

  @example
  ```svelte
  <RequireAuth>
    {#snippet children()}
      <ProtectedContent />
    {/snippet}
    {#snippet fallback()}
      <p>Loading...</p>
    {/snippet}
  </RequireAuth>
  ```
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { LoginOptions } from "oidc-js";
  import { isExpiredAt } from "oidc-js-core";
  import { getAuthContext } from "./context.svelte.js";

  interface Props {
    /** Child content rendered when the user is authenticated. */
    children: Snippet;
    /** Content rendered while loading or refreshing. Defaults to nothing. */
    fallback?: Snippet;
    /** Whether to automatically refresh an expired token. Defaults to true. */
    autoRefresh?: boolean;
    /** Options to pass to the login redirect if authentication is required. */
    loginOptions?: LoginOptions;
    /** Buffer in milliseconds before token expiry to consider it expired. Defaults to 30000. */
    tokenExpirationBuffer?: number;
  }

  let { children, fallback, autoRefresh = true, loginOptions, tokenExpirationBuffer }: Props = $props();

  const auth = getAuthContext();
  let refreshAttempted = false;

  $effect(() => {
    const isExpired = isExpiredAt(auth.tokens.expiresAt, tokenExpirationBuffer);
    const needsAuth = !auth.isAuthenticated || isExpired;

    if (!needsAuth) {
      refreshAttempted = false;
      return;
    }
    if (auth.isLoading) return;

    if (autoRefresh && !refreshAttempted) {
      refreshAttempted = true;
      auth.actions.refresh().catch(() => auth.actions.login(loginOptions));
      return;
    }

    auth.actions.login(loginOptions);
  });
</script>

{#if auth.isLoading || !auth.isAuthenticated || isExpiredAt(auth.tokens.expiresAt, tokenExpirationBuffer)}
  {#if fallback}
    {@render fallback()}
  {/if}
{:else}
  {@render children()}
{/if}
