<script lang="ts">
  import { getAuthContext } from "oidc-js-svelte";

  const auth = getAuthContext();
</script>

{#if auth.error}
  <div data-testid="auth-error">Error: {auth.error.message}</div>
{:else}
  <div data-testid="auth-loading">Processing login...</div>
{/if}
