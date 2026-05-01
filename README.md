# oidc-js

Drop-in OIDC authentication for every JavaScript framework.

Existing OIDC libraries are either too complex ([oidc-client-ts](https://github.com/authts/oidc-client-ts) with its bloated UserManager, iframe magic, and maintenance issues) or too low-level ([oauth4webapi](https://github.com/panva/oauth4webapi) where you wire everything yourself). The result: every framework re-implements the same OIDC plumbing from scratch, and developers spend days on auth instead of building their app.

**oidc-js** fixes this. One functional core handles the OIDC protocol. Thin framework adapters give you `<AuthProvider>`, `useAuth()`, guards, and interceptors. Just drop them in and go. No dancing around framework-specific workarounds. No re-implementing token exchange for the fifth time. No dependencies.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`oidc-js-core`](./packages/core) | Pure functions for OIDC protocol operations | Published |
| [`oidc-js`](./packages/client) | Framework-agnostic client with `fetch` + `sessionStorage` | Published |
| [`oidc-js-react`](./packages/react) | React provider, hooks, and route guards | Published |
| [`oidc-js-angular`](./packages/angular) | Angular service, guard, and interceptor | Planned |
| [`oidc-js-vue`](./packages/vue) | Vue plugin and composables | Planned |
| [`oidc-js-svelte`](./packages/svelte) | Svelte stores | Planned |
| [`oidc-js-solid`](./packages/solid) | SolidJS signals | Planned |

## Architecture

```
oidc-js-core              Pure functions. No IO. No state.
    |
    ├── oidc-js            core + fetch + sessionStorage
    ├── oidc-js-react      core + fetch + React context/hooks
    ├── oidc-js-angular    core + HttpClient + Angular DI
    ├── oidc-js-vue        core + fetch + Vue composables
    ├── oidc-js-svelte     core + fetch + Svelte stores
    └── oidc-js-solid      core + fetch + Solid signals
```

The core never calls `fetch` or touches browser APIs (except Web Crypto for PKCE). Each framework adapter composes the core functions with its own HTTP layer and state management. This means:

- **Angular** uses `HttpClient` with its interceptor chain, not a `fetch` workaround
- **React/Vue/Svelte/Solid** use `fetch` directly, lightweight with no wrapper overhead
- **Node.js/Deno/Bun** work out of the box, no browser polyfills required
- **Tests are trivial**: pure input/output, no mocking `fetch` or `window`

## Core API

### Install

```bash
npm install oidc-js-core
```

### Configuration

```typescript
import type { OidcConfig } from "oidc-js-core";

// Public client (SPA)
const config: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-app",
  redirectUri: "http://localhost:3000/callback",
  scopes: ["openid", "profile", "email"],
};

// Confidential client (Node.js API server)
const apiConfig: OidcConfig = {
  issuer: "https://auth.example.com",
  clientId: "my-api",
  clientSecret: "secret",
};
```

### Authorization Code + PKCE Flow

```typescript
import {
  buildDiscoveryUrl,
  parseDiscoveryResponse,
  generatePkce,
  generateState,
  generateNonce,
  buildAuthUrl,
  parseCallbackUrl,
  buildTokenRequest,
  parseTokenResponse,
} from "oidc-js-core";

// 1. Fetch discovery document
const discoveryUrl = buildDiscoveryUrl(config.issuer);
const response = await fetch(discoveryUrl);
const discovery = parseDiscoveryResponse(await response.json(), config.issuer);

// 2. Build authorization URL
const pkce = await generatePkce();
const state = generateState();
const nonce = generateNonce();
const authUrl = buildAuthUrl(discovery, config, pkce, state, nonce);

// Store pkce.verifier, state, and nonce (e.g. in sessionStorage)
// Then redirect: window.location.href = authUrl;

// 3. Handle callback
const { code } = parseCallbackUrl(window.location.href, state);

// 4. Exchange code for tokens
const tokenReq = buildTokenRequest(discovery, config, code, pkce.verifier);
const tokenRes = await fetch(tokenReq.url, {
  method: tokenReq.method,
  headers: tokenReq.headers,
  body: tokenReq.body,
});
const tokens = parseTokenResponse(await tokenRes.json(), nonce);
// tokens.access_token, tokens.id_token, tokens.refresh_token, tokens.expires_at
```

### Token Refresh

```typescript
import { buildRefreshRequest, parseTokenResponse } from "oidc-js-core";

const refreshReq = buildRefreshRequest(discovery, config, tokens.refresh_token);
const res = await fetch(refreshReq.url, {
  method: refreshReq.method,
  headers: refreshReq.headers,
  body: refreshReq.body,
});
const newTokens = parseTokenResponse(await res.json());
```

### UserInfo

```typescript
import { buildUserinfoRequest, parseUserinfoResponse } from "oidc-js-core";

const userinfoReq = buildUserinfoRequest(discovery, tokens.access_token);
const res = await fetch(userinfoReq.url, { headers: userinfoReq.headers });
const user = parseUserinfoResponse(await res.json());
// user.sub, user.email, user.name, user.preferred_username
```

### Token Introspection (Confidential Clients)

```typescript
import { buildIntrospectRequest, parseIntrospectResponse } from "oidc-js-core";

const introspectReq = buildIntrospectRequest(discovery, apiConfig, accessToken);
const res = await fetch(introspectReq.url, {
  method: introspectReq.method,
  headers: introspectReq.headers,
  body: introspectReq.body,
});
const result = parseIntrospectResponse(await res.json());
// result.active, result.sub, result.scope, result.exp
```

### Token Revocation

```typescript
import { buildRevocationRequest } from "oidc-js-core";

const revokeReq = buildRevocationRequest(discovery, config, tokens.refresh_token, "refresh_token");
if (revokeReq) {
  await fetch(revokeReq.url, {
    method: revokeReq.method,
    headers: revokeReq.headers,
    body: revokeReq.body,
  });
}
```

### Logout

```typescript
import { buildLogoutUrl } from "oidc-js-core";

const logoutUrl = buildLogoutUrl(discovery, tokens.id_token, "http://localhost:3000");
if (logoutUrl) {
  window.location.href = logoutUrl;
}
```

### Token Expiry Utilities

```typescript
import { isTokenExpired, timeUntilExpiry } from "oidc-js-core";

if (isTokenExpired(tokens)) {
  // refresh the token
}

const secondsLeft = timeUntilExpiry(tokens);
// schedule a refresh before expiry
```

### JWT Decoding

```typescript
import { decodeJwtPayload, parseIdTokenClaims } from "oidc-js-core";

// Decode any JWT payload (no signature verification)
const claims = decodeJwtPayload(tokens.access_token);

// Parse ID token into typed OidcUser
const user = parseIdTokenClaims(tokens.id_token);
```

## Complete API Reference

### Discovery

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildDiscoveryUrl` | `(issuer: string) => string` | Build `.well-known/openid-configuration` URL |
| `parseDiscoveryResponse` | `(data: unknown, expectedIssuer: string) => OidcDiscovery` | Validate and parse discovery document |

### PKCE & Randomness

| Function | Signature | Description |
|----------|-----------|-------------|
| `generatePkce` | `() => Promise<{ verifier, challenge }>` | Generate PKCE code verifier + S256 challenge |
| `computeCodeChallenge` | `(verifier: string) => Promise<string>` | Compute S256 challenge from verifier |
| `generateState` | `() => string` | Generate random state parameter |
| `generateNonce` | `() => string` | Generate random nonce |
| `generateRandom` | `(length?: number) => string` | Generate random string of unreserved characters |

### Authorization

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildAuthUrl` | `(discovery, config, pkce, state, nonce, extraParams?) => string` | Build authorization endpoint URL |
| `parseCallbackUrl` | `(url: string, expectedState: string) => { code, state }` | Parse and validate callback URL |

### Token Exchange

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildTokenRequest` | `(discovery, config, code, codeVerifier) => HttpRequest` | Build authorization code exchange request |
| `buildRefreshRequest` | `(discovery, config, refreshToken) => HttpRequest` | Build refresh token request |
| `parseTokenResponse` | `(data: unknown, expectedNonce?) => TokenSet` | Parse and validate token response |

### UserInfo

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildUserinfoRequest` | `(discovery, accessToken) => HttpRequest` | Build userinfo endpoint request |
| `parseUserinfoResponse` | `(data: unknown) => OidcUser` | Parse userinfo response |

### Introspection

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildIntrospectRequest` | `(discovery, config, token) => HttpRequest` | Build token introspection request (requires `clientSecret`) |
| `parseIntrospectResponse` | `(data: unknown) => IntrospectionResponse` | Parse introspection response |

### Revocation

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildRevocationRequest` | `(discovery, config, token, hint?) => HttpRequest \| null` | Build revocation request (null if no endpoint) |

### Logout

| Function | Signature | Description |
|----------|-----------|-------------|
| `buildLogoutUrl` | `(discovery, idToken?, postLogoutRedirectUri?) => string \| null` | Build RP-initiated logout URL (null if no endpoint) |

### JWT

| Function | Signature | Description |
|----------|-----------|-------------|
| `decodeJwtPayload` | `(token: string) => Record<string, unknown>` | Decode JWT payload (no signature verification) |
| `parseIdTokenClaims` | `(idToken: string) => OidcUser` | Parse ID token into typed user claims |

### Token Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `computeExpiresAt` | `(expiresIn: number) => number` | Compute absolute expiry timestamp |
| `isTokenExpired` | `(tokenSet, clockSkewSeconds?) => boolean` | Check if token is expired |
| `timeUntilExpiry` | `(tokenSet) => number` | Seconds until token expires (0 if expired, Infinity if no expiry) |

## Error Handling

All errors throw `OidcError` with a typed `code` property:

```typescript
import { OidcError } from "oidc-js-core";

try {
  const result = parseCallbackUrl(url, expectedState);
} catch (e) {
  if (e instanceof OidcError) {
    switch (e.code) {
      case "STATE_MISMATCH":
        // CSRF protection triggered
        break;
      case "AUTHORIZATION_ERROR":
        // Server returned an error (e.g. access_denied)
        break;
    }
  }
}
```

| Error Code | Thrown By | Meaning |
|------------|----------|---------|
| `DISCOVERY_INVALID` | `parseDiscoveryResponse` | Missing required fields or non-object input |
| `DISCOVERY_ISSUER_MISMATCH` | `parseDiscoveryResponse` | Issuer in response doesn't match expected |
| `STATE_MISMATCH` | `parseCallbackUrl` | State parameter doesn't match (CSRF) |
| `NONCE_MISMATCH` | `parseTokenResponse` | Nonce in ID token doesn't match |
| `MISSING_AUTH_CODE` | `parseCallbackUrl` | No authorization code in callback URL |
| `INVALID_JWT` | `decodeJwtPayload` | Malformed JWT |
| `TOKEN_EXCHANGE_ERROR` | `parseTokenResponse` | Invalid token response |
| `AUTHORIZATION_ERROR` | `parseCallbackUrl` | Authorization server returned an error |
| `MISSING_REDIRECT_URI` | `buildAuthUrl` | `redirectUri` not set in config |
| `MISSING_CLIENT_SECRET` | `buildIntrospectRequest` | `clientSecret` required but not set |

## RFC Compliance

Every validation and return path in the source code is annotated with the specific RFC section it implements. The library conforms to:

- [RFC 6749](https://tools.ietf.org/html/rfc6749): OAuth 2.0 Authorization Framework
- [RFC 7636](https://tools.ietf.org/html/rfc7636): Proof Key for Code Exchange (PKCE)
- [RFC 7009](https://tools.ietf.org/html/rfc7009): OAuth 2.0 Token Revocation
- [RFC 7662](https://tools.ietf.org/html/rfc7662): OAuth 2.0 Token Introspection
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [OpenID Connect RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)

## Testing

Every framework adapter runs against a real OIDC identity provider — no mocked endpoints, no simulated responses. The E2E suite spins up a live [Autentico](https://github.com/eugenioenko/autentico) instance, performs actual OAuth 2.0 flows through a browser, and asserts on both the UI state and the exact OIDC network traffic.

**16 tests** cover the full OIDC lifecycle:

| Category | Tests |
|----------|-------|
| Login flow | Unauthenticated state, full login with tokens, ID token claims, userinfo profile, fetchProfile toggle, logout, manual refresh |
| Security | Tokens not in storage, back-button after logout |
| Error handling | IdP error callback, CSRF state mismatch |
| Deep linking | Login from protected page preserves returnTo |
| RequireAuth | Protected content, multi-page navigation without re-auth, auto-refresh on expired token, login redirect on revoked refresh token |

Every test also asserts the exact sequence of OIDC fetch requests (`discovery → token → userinfo`) and page navigations (`/oauth2/authorize`, `/oauth2/logout`) to verify no unexpected network calls are made. This catches regressions that UI-only assertions would miss — like a silent double-refresh or a missing discovery call.

The test harness is framework-agnostic: each adapter implements the same `data-testid` contract and runs the same Playwright spec. See [`tests/e2e/harness.md`](./tests/e2e/harness.md) for the full contract.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build core only
pnpm --filter oidc-js-core build

# Run tests
pnpm --filter oidc-js-core test

# Type check
pnpm --filter oidc-js-core lint
```

### Tech Stack

- **pnpm workspaces** for monorepo management
- **TypeScript** in strict mode
- **Vite 8** library mode builds (dual ESM/CJS)
- **Vitest 4** test runner

## License

MIT
