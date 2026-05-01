# oidc-js

Stateful OIDC client for JavaScript -- wraps `oidc-js-core` with `fetch`, `sessionStorage`, and state change callbacks.

`oidc-js` is the framework-agnostic layer that React, Vue, Svelte, Solid, and Preact adapters build on top of. It handles the full Authorization Code + PKCE flow: discovery, redirect-based login, callback handling, token refresh, userinfo fetching, and logout. Zero dependencies beyond `oidc-js-core`.

## Install

```bash
npm install oidc-js
```

## Quick start

```ts
import { OidcClient } from "oidc-js";

const client = new OidcClient({
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: window.location.origin + "/callback",
  scopes: ["openid", "profile"],
});

// Subscribe to state changes
client.subscribe((state) => {
  console.log("authenticated:", state.isAuthenticated);
  console.log("user:", state.user);
});

// Initialize: fetches discovery and handles any callback in the URL
const { returnTo } = await client.init();

if (returnTo) {
  // Navigate to the path the user was on before login
  history.replaceState(null, "", returnTo);
}

// Trigger login when the user clicks a button
loginButton.addEventListener("click", () => client.login());

// Trigger logout
logoutButton.addEventListener("click", () => client.logout());
```

## API

### `new OidcClient(config)`

Creates a new client instance. Does not perform any IO until `init()` is called.

### `client.init(): Promise<{ returnTo?: string }>`

Fetches the OIDC discovery document and checks the current URL for callback parameters. If an authorization code is present, it completes the token exchange, optionally fetches the userinfo profile, and returns the `returnTo` path that was saved before login. Call this once on app startup.

### `client.login(options?): Promise<void>`

Starts the Authorization Code + PKCE flow by redirecting the browser to the authorization endpoint. Generates PKCE, state, and nonce values and persists them in `sessionStorage` before navigating away.

`options` accepts:

| Field | Type | Description |
|-------|------|-------------|
| `returnTo` | `string` | Path to return to after login. Defaults to the current location. |
| `extraParams` | `Record<string, string>` | Additional query parameters for the authorization request. |

### `client.logout(): void`

Clears local auth state and redirects the browser to the provider's end-session endpoint (if available).

### `client.refresh(): Promise<void>`

Uses the stored refresh token to obtain a new set of tokens. Throws if no refresh token is available.

### `client.fetchProfile(): Promise<void>`

Fetches the userinfo endpoint with the current access token and updates `state.user.profile`. Throws if no access token is available.

### `client.subscribe(fn): () => void`

Registers a callback that fires whenever the auth state changes. Returns an unsubscribe function.

### `client.state: AuthState`

The current authentication state (read-only).

### `client.destroy(): void`

Aborts any in-flight requests and removes all subscribers.

## State shape

```ts
interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  tokens: AuthTokens;
}

interface AuthUser {
  claims: IdTokenClaims;
  profile: OidcUser | null;  // null if fetchProfile is disabled
}

interface AuthTokens {
  access: string | null;
  id: string | null;
  refresh: string | null;
  expiresAt: number | null;  // milliseconds since epoch
}
```

## Configuration

`OidcClientConfig` extends the core `OidcConfig` with one additional option:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `issuer` | `string` | -- | OIDC provider URL (required). |
| `clientId` | `string` | -- | OAuth 2.0 client identifier (required). |
| `redirectUri` | `string` | -- | Redirect URI registered with the provider (required for login). |
| `scopes` | `string[]` | `["openid"]` | OAuth 2.0 scopes to request. |
| `postLogoutRedirectUri` | `string` | -- | Where to send the user after logout. |
| `fetchProfile` | `boolean` | `true` | Whether to fetch the userinfo endpoint after token exchange. |

## Exported types

```ts
import type {
  OidcClientConfig,
  AuthState,
  AuthUser,
  AuthTokens,
  IdTokenClaims,
  LoginOptions,
} from "oidc-js";
```

Re-exported from `oidc-js-core`: `OidcConfig`, `OidcUser`, `TokenSet`.

## License

MIT -- see [LICENSE](../../LICENSE).

## Links

- [GitHub repository](https://github.com/eugenioenko/oidc-js)
- [Core library (`oidc-js-core`)](https://github.com/eugenioenko/oidc-js/tree/main/packages/core)
