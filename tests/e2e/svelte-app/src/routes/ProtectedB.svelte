<script lang="ts">
  import { RequireAuth } from "oidc-js-svelte";

  interface Props {
    navigate: (to: string) => void;
  }

  let { navigate }: Props = $props();

  function goTo(e: MouseEvent, path: string) {
    e.preventDefault();
    navigate(path);
  }
</script>

<RequireAuth>
  {#snippet children()}
    <div data-testid="protected-b">
      Protected content b
    </div>
    <nav>
      <a href="/" data-testid="link-home" onclick={(e) => goTo(e, "/")}>Home</a>
      <a href="/protected-a" data-testid="link-protected-a" onclick={(e) => goTo(e, "/protected-a")}>Protected A</a>
      <a href="/protected-b" data-testid="link-protected-b" onclick={(e) => goTo(e, "/protected-b")}>Protected B</a>
    </nav>
  {/snippet}
  {#snippet fallback()}
    <div data-testid="auth-loading">Refreshing...</div>
  {/snippet}
</RequireAuth>
