# oidc-js-lit

Simple OIDC authentication for Lit. Drop-in reactive controllers for login, logout, and token refresh with zero dependencies.

Part of the [oidc-js](https://github.com/eugenioenko/oidc-js) family -- OpenID Connect for every JavaScript framework.

## Install

```bash
npm install oidc-js-lit
```

`lit` (>=3) is a peer dependency.

## Quick start

Create an `AuthController` in a LitElement and use its properties in `render()`:

```ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { AuthController } from "oidc-js-lit";

@customElement("my-app")
class MyApp extends LitElement {
  private auth = new AuthController(this, {
    config: {
      issuer: "https://auth.example.com",
      clientId: "my-app",
      redirectUri: "http://localhost:3000/callback",
      scopes: ["openid", "profile", "email"],
    },
  });

  render() {
    if (this.auth.isLoading) return html`<p>Loading...</p>`;

    if (!this.auth.isAuthenticated) {
      return html`<button @click=${() => this.auth.login()}>Log in</button>`;
    }

    return html`
      <p>Welcome, ${this.auth.user?.profile?.name}</p>
      <button @click=${() => this.auth.logout()}>Log out</button>
    `;
  }
}
```

The controller subscribes to the underlying `OidcClient` and calls `host.requestUpdate()` whenever the authentication state changes, so the host element re-renders automatically.

## RequireAuthController

Guard a page so only authenticated users see its content. If the user is not authenticated, the controller attempts a silent token refresh and falls back to a login redirect.

```ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { AuthController, RequireAuthController } from "oidc-js-lit";

@customElement("protected-page")
class ProtectedPage extends LitElement {
  private auth = new AuthController(this, {
    config: {
      issuer: "https://auth.example.com",
      clientId: "my-app",
      redirectUri: "http://localhost:3000/callback",
      scopes: ["openid", "profile"],
    },
  });

  private guard = new RequireAuthController(this, { auth: this.auth });

  render() {
    if (!this.guard.authorized) return html`<p>Redirecting to login...</p>`;
    return html`<p>Protected content</p>`;
  }
}
```

Disable the automatic refresh attempt with `autoRefresh: false`:

```ts
private guard = new RequireAuthController(this, {
  auth: this.auth,
  autoRefresh: false,
});
```

## API reference

### AuthController

A Lit `ReactiveController` that manages OIDC authentication state. Created in the host element's constructor (or as a class field) and registered via `host.addController`.

```ts
const auth = new AuthController(host, options);
```

**AuthControllerOptions**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `config` | `OidcConfig` | required | OIDC client configuration (issuer, clientId, redirectUri, scopes, etc.) |
| `fetchProfile` | `boolean` | `true` | Fetch the userinfo endpoint after login to populate `user.profile` |
| `onLogin` | `(returnTo: string) => void` | `undefined` | Called after a successful login redirect. Receives the original URL the user was on. If omitted, `history.replaceState` restores the URL automatically. |
| `onError` | `(error: Error) => void` | `undefined` | Called when an authentication error occurs during initialization |

**Properties**

| Property | Type | Description |
|----------|------|-------------|
| `user` | `AuthUser \| null` | The authenticated user, or `null` if not logged in |
| `isAuthenticated` | `boolean` | Whether the user is currently authenticated |
| `isLoading` | `boolean` | Whether initialization or a token exchange is in progress |
| `error` | `Error \| null` | The most recent authentication error, or `null` |
| `tokens` | `AuthTokens` | Current set of OAuth 2.0 tokens |
| `config` | `OidcConfig` | The OIDC configuration passed to the controller |

**Methods**

| Method | Signature | Description |
|--------|-----------|-------------|
| `login` | `(options?: LoginOptions) => Promise<void>` | Starts the Authorization Code + PKCE login flow |
| `logout` | `() => void` | Clears local state and redirects to the OP's end-session endpoint |
| `refresh` | `() => Promise<void>` | Uses the refresh token to obtain new tokens |
| `fetchProfile` | `() => Promise<void>` | Fetches the user's profile from the userinfo endpoint |

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

### RequireAuthController

A Lit `ReactiveController` that guards content behind authentication. Observes an `AuthController` and determines whether the user is authorized to view protected content.

```ts
const guard = new RequireAuthController(host, options);
```

**RequireAuthOptions**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `auth` | `AuthController` | required | The `AuthController` instance to observe |
| `autoRefresh` | `boolean` | `true` | Attempt a silent token refresh before redirecting to login |
| `loginOptions` | `LoginOptions` | `undefined` | Options passed to `login()` when a redirect is triggered |

**Properties**

| Property | Type | Description |
|----------|------|-------------|
| `authorized` | `boolean` | Whether the user is authorized to view protected content |

## Documentation

Full documentation: [https://eugenioenko.github.io/oidc-js/lit/auth-controller/](https://eugenioenko.github.io/oidc-js/lit/auth-controller/)

## Repository

[https://github.com/eugenioenko/oidc-js](https://github.com/eugenioenko/oidc-js)

## License

MIT
