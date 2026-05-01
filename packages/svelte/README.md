# oidc-js-svelte

Svelte 5 adapter for [oidc-js](https://github.com/eugenioenko/oidc-js) -- reactive OIDC authentication using runes and the Svelte context API.

## Install

```bash
npm install oidc-js-svelte
```

`svelte >= 5.0.0` is required as a peer dependency.

## Quick Start

Wrap your application with `AuthProvider` and pass your OIDC configuration:

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { AuthProvider } from "oidc-js-svelte";

  const config = {
    issuer: "https://auth.example.com",
    clientId: "my-client-id",
    redirectUri: "http://localhost:5173/callback",
    scopes: ["openid", "profile", "email"],
  };
</script>

<AuthProvider {config}>
  <main>
    <h1>My App</h1>
  </main>
</AuthProvider>
```

Access authentication state and actions in any child component with `getAuthContext()`:

```svelte
<!-- Profile.svelte -->
<script lang="ts">
  import { getAuthContext } from "oidc-js-svelte";

  const auth = getAuthContext();
</script>

{#if auth.isLoading}
  <p>Loading...</p>
{:else if auth.isAuthenticated}
  <p>Hello, {auth.user?.name}</p>
  <button onclick={() => auth.actions.logout()}>Log out</button>
{:else}
  <button onclick={() => auth.actions.login()}>Log in</button>
{/if}
```

## RequireAuth

`RequireAuth` guards content behind authentication. When the user is not authenticated it automatically attempts a token refresh, and if that fails, redirects to login.

Use Svelte 5 snippets for the `children` (authenticated content) and optional `fallback` (loading state) slots:

```svelte
<script lang="ts">
  import { RequireAuth } from "oidc-js-svelte";
</script>

<RequireAuth>
  {#snippet children()}
    <p>This content is only visible to authenticated users.</p>
  {/snippet}
  {#snippet fallback()}
    <p>Checking authentication...</p>
  {/snippet}
</RequireAuth>
```

To disable automatic token refresh or pass options to the login redirect:

```svelte
<RequireAuth autoRefresh={false} loginOptions={{ returnTo: "/dashboard" }}>
  {#snippet children()}
    <p>Protected content</p>
  {/snippet}
</RequireAuth>
```

## API Reference

### `AuthProvider`

Component that provides OIDC authentication context to all descendants.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `config` | `OidcConfig` | (required) | OIDC configuration (issuer, clientId, redirectUri, scopes). |
| `fetchProfile` | `boolean` | `true` | Whether to fetch the userinfo profile after token exchange. |
| `onLogin` | `(returnTo: string) => void` | `undefined` | Callback invoked after a successful login with the return-to path. |
| `onError` | `(error: Error) => void` | `undefined` | Callback invoked when an authentication error occurs. |

### `getAuthContext()`

Returns a reactive `AuthContextValue` object. Must be called during component initialization inside an `AuthProvider` ancestor.

```ts
interface AuthContextValue {
  readonly config: OidcConfig;
  readonly user: AuthUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly tokens: AuthTokens;
  readonly actions: AuthActions;
}
```

**AuthActions**

| Action | Signature | Description |
| --- | --- | --- |
| `login` | `(options?: LoginOptions) => void` | Redirects to the authorization endpoint. |
| `logout` | `() => void` | Ends the session and redirects to the logout endpoint. |
| `refresh` | `() => Promise<void>` | Refreshes the access token using the stored refresh token. |
| `fetchProfile` | `() => Promise<void>` | Fetches the user profile from the userinfo endpoint. |

### `RequireAuth`

Component that guards content behind authentication.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `autoRefresh` | `boolean` | `true` | Whether to automatically refresh an expired token before redirecting to login. |
| `loginOptions` | `LoginOptions` | `undefined` | Options passed to the login redirect when authentication is required. |

**Snippet slots**

| Slot | Description |
| --- | --- |
| `children` | Content rendered when the user is authenticated. |
| `fallback` | Content rendered while loading or refreshing. Defaults to nothing. |

### Re-exported Types

The package re-exports these types for convenience:

- `OidcConfig`, `OidcUser`, `TokenSet` from `oidc-js-core`
- `IdTokenClaims`, `AuthUser`, `AuthTokens`, `LoginOptions` from `oidc-js`
- `AuthActions`, `AuthContextValue` defined in this package

## Documentation

Full documentation is available at [eugenioenko.github.io/oidc-js/svelte/auth-provider/](https://eugenioenko.github.io/oidc-js/svelte/auth-provider/).

## Repository

[github.com/eugenioenko/oidc-js](https://github.com/eugenioenko/oidc-js)

## License

MIT
