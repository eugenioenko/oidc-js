# oidc-js-preact

Preact adapter for [oidc-js](https://github.com/eugenioenko/oidc-js). Provides `AuthProvider`, `useAuth` hook, and `RequireAuth` component for OpenID Connect authentication.

## Install

```bash
npm install oidc-js-preact
```

`preact` (>=10) is a peer dependency.

## Quick start

Wrap your app with `AuthProvider`:

```tsx
import { AuthProvider } from "oidc-js-preact";

const config = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
  scopes: ["openid", "profile", "email"],
};

function App() {
  return (
    <AuthProvider config={config}>
      <Main />
    </AuthProvider>
  );
}
```

Use the `useAuth` hook in any child component:

```tsx
import { useAuth } from "oidc-js-preact";

function Main() {
  const { isAuthenticated, isLoading, user, actions } = useAuth();

  if (isLoading) return <p>Loading...</p>;

  if (!isAuthenticated) {
    return <button onClick={() => actions.login()}>Log in</button>;
  }

  return (
    <div>
      <p>Welcome, {user?.profile?.name}</p>
      <button onClick={() => actions.logout()}>Log out</button>
    </div>
  );
}
```

## RequireAuth

Guard a subtree so only authenticated users see it. Unauthenticated users are redirected to login automatically.

```tsx
import { RequireAuth } from "oidc-js-preact";

function ProtectedPage() {
  return (
    <RequireAuth fallback={<p>Redirecting to login...</p>}>
      <Dashboard />
    </RequireAuth>
  );
}
```

`RequireAuth` will attempt a silent token refresh before redirecting. Disable this with `autoRefresh={false}`:

```tsx
<RequireAuth autoRefresh={false}>
  <Dashboard />
</RequireAuth>
```

## API reference

### AuthProvider

Context provider that initializes the OIDC client and manages authentication state.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `OidcConfig` | required | OIDC client configuration (issuer, clientId, redirectUri, scopes, etc.) |
| `fetchProfile` | `boolean` | `true` | Fetch the userinfo endpoint after login to populate `user.profile` |
| `onLogin` | `(returnTo: string) => void` | `undefined` | Called after a successful login redirect. Receives the original URL the user was on. If omitted, `history.replaceState` restores the URL automatically. |
| `onError` | `(error: Error) => void` | `undefined` | Called when an authentication error occurs during initialization |
| `children` | `ComponentChildren` | required | Child components |

### useAuth()

Hook that returns the current `AuthContextValue`. Must be called inside an `AuthProvider`.

```ts
interface AuthContextValue {
  config: OidcConfig;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  tokens: AuthTokens;
  actions: AuthActions;
}
```

**AuthUser**

```ts
interface AuthUser {
  claims: IdTokenClaims;
  profile: OidcUser | null;
}
```

`claims` are decoded from the ID token. `profile` is populated from the userinfo endpoint when `fetchProfile` is enabled.

**AuthTokens**

```ts
interface AuthTokens {
  access: string | null;
  id: string | null;
  refresh: string | null;
  expiresAt: number | null;
}
```

**AuthActions**

```ts
interface AuthActions {
  login: (options?: LoginOptions) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}
```

### RequireAuth

Component that guards its children behind authentication. Renders `fallback` while loading or when the user is not authenticated.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoRefresh` | `boolean` | `true` | Attempt a silent token refresh before redirecting to login |
| `loginOptions` | `LoginOptions` | `undefined` | Options passed to `login()` when a redirect is triggered |
| `fallback` | `ComponentChildren` | `null` | Rendered while loading or redirecting |
| `children` | `ComponentChildren` | required | Content shown to authenticated users |

## Documentation

Full documentation: [https://eugenioenko.github.io/oidc-js/preact/auth-provider/](https://eugenioenko.github.io/oidc-js/preact/auth-provider/)

## Repository

[https://github.com/eugenioenko/oidc-js](https://github.com/eugenioenko/oidc-js)

## License

MIT
