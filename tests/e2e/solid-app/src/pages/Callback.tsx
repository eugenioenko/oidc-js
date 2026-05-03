import { Show } from "solid-js";
import { useAuth } from "oidc-js-solid";

export function CallbackPage() {
  const auth = useAuth();
  return (
    <Show when={!auth.error} fallback={<div data-testid="auth-error">Error: {auth.error!.message}</div>}>
      <div data-testid="auth-loading">Processing login...</div>
    </Show>
  );
}
