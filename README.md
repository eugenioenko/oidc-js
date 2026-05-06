# oidc-js

[![CI](https://github.com/eugenioenko/oidc-js/actions/workflows/ci.yml/badge.svg)](https://github.com/eugenioenko/oidc-js/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/oidc-js-core)](https://www.npmjs.com/package/oidc-js-core)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)](./packages/core/package.json)
[![license](https://img.shields.io/github/license/eugenioenko/oidc-js)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](./tsconfig.base.json)

Drop-in OIDC authentication for every JavaScript framework.

## Why oidc-js

Most OIDC libraries couple protocol logic with a specific HTTP and framework model. This can make it harder to integrate cleanly with frameworks that have their own patterns (e.g., Angular's `HttpClient`), forces tests to mock `window` and network calls, and leads every framework to re-implement the same token exchange.

**oidc-js** separates these concerns:

- **Functional core** — pure functions that build requests and parse responses. No `fetch`, no storage, no side effects. Deterministic and testable with plain input/output.
- **Thin adapters** — each framework composes the core with its own HTTP layer and reactivity. Angular uses `HttpClient`. React uses hooks. Svelte uses runes. No framework-specific workarounds.
- **Zero dependencies** — the core uses only the Web Crypto API. Works in any JS runtime: browser, Node, Deno, Bun, Workers.

## When Not to Use oidc-js

- **Server-side applications that require JWT signature verification** — the core decodes but does not cryptographically verify tokens. Use a server-side library with JWK validation instead.
- **Applications that require persistent sessions across page reloads without refresh tokens** — tokens are stored in memory only and are lost on navigation or refresh.
- **Environments with strict compliance requirements** (e.g., FIPS, FedRAMP) — this library does not implement the additional validation layers those standards require.

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| [`oidc-js-core`](./packages/core) | Pure functions for OIDC protocol operations | [API](./packages/core/README.md) |
| [`oidc-js`](./packages/client) | Framework-agnostic client with `fetch` + `sessionStorage` | [API](./packages/client/README.md) |
| [`oidc-js-react`](./packages/react) | React provider, hooks, and route guards | [API](./packages/react/README.md) |
| [`oidc-js-vue`](./packages/vue) | Vue plugin, composables, and navigation guard | [API](./packages/vue/README.md) |
| [`oidc-js-svelte`](./packages/svelte) | Svelte 5 context and components | [API](./packages/svelte/README.md) |
| [`oidc-js-angular`](./packages/angular) | Angular service, DI, and route guard | [API](./packages/angular/README.md) |
| [`oidc-js-solid`](./packages/solid) | SolidJS signals, context, and components | [API](./packages/solid/README.md) |
| [`oidc-js-preact`](./packages/preact) | Preact hooks and components | [API](./packages/preact/README.md) |
| [`oidc-js-lit`](./packages/lit) | Lit reactive controllers | [API](./packages/lit/README.md) |
| [`oidc-js-kasper`](./packages/kasper) | Kasper integration | [API](./packages/kasper/README.md) |

## Architecture

```
oidc-js-core              Pure functions. No IO. No state.
    |
    ├── oidc-js            core + fetch + sessionStorage
    ├── oidc-js-react      core + fetch + React context/hooks
    ├── oidc-js-vue        core + fetch + Vue plugin/composables
    ├── oidc-js-svelte     core + fetch + Svelte 5 runes/context
    ├── oidc-js-angular    core + HttpClient + Angular signals/DI
    ├── oidc-js-solid      core + fetch + Solid signals/context
    ├── oidc-js-preact     core + fetch + Preact hooks
    ├── oidc-js-lit        core + fetch + Lit reactive controllers
    └── oidc-js-kasper     core + fetch + Kasper integration
```

The core never calls `fetch` or touches browser APIs (except Web Crypto for PKCE). Each framework adapter composes the core with its own HTTP layer and state management.

## Quick Start

Install the adapter for your framework:

```bash
npm install oidc-js-react    # or oidc-js-vue, oidc-js-svelte, etc
```

Wrap your app with the provider:

```tsx
import { AuthProvider } from "oidc-js-react";

function App() {
  return (
    <AuthProvider
      issuer="https://auth.example.com"
      clientId="my-app"
      redirectUri="http://localhost:3000/callback"
      scopes={["openid", "profile", "email"]}
    >
      <MyApp />
    </AuthProvider>
  );
}
```

Use the hook anywhere:

```tsx
import { useAuth } from "oidc-js-react";

function Profile() {
  const { isAuthenticated, user, actions } = useAuth();

  if (!isAuthenticated) {
    return <button onClick={() => actions.login()}>Log in</button>;
  }

  return <p>Hello, {user?.claims?.name}</p>;
}
```

See each package's README for framework-specific setup, full API reference, and configuration options.

## Security Model

### Security Philosophy

The real security boundary in an OIDC application is the **resource server**, not the browser. oidc-js is designed around this principle.

**Tokens are treated as opaque on the client.** An access token is a bearer token — if an attacker steals it via XSS, they use it as-is. Client-side signature verification doesn't prevent that. The server must validate every token before granting access regardless of what the client does, making browser-side verification redundant rather than "defense in depth."

**Tokens arrive over a trusted channel.** In the Authorization Code + PKCE flow, the client exchanges the code for tokens directly with the IdP over TLS. The OpenID Connect spec explicitly permits this: *"If the ID Token is received via direct communication between the Client and the Token Endpoint, the TLS server validation MAY be used to validate the issuer in place of checking the token signature"* ([OIDC Core 1.0 §3.1.3.7, step 6](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)). If you can't trust the HTTPS channel, signature verification won't save you — an attacker who compromised your discovery or DNS could serve a validly signed token from a malicious IdP.

**Where oidc-js invests instead:**

- **Memory-only token storage** — tokens never touch `localStorage` or `sessionStorage`, limiting XSS-based token theft, the primary threat to SPAs
- **Zero runtime dependencies** — no dependency tree means no supply chain attack surface in the core package
- **Modern refresh flow** — uses refresh tokens instead of iframe-based silent auth, avoiding third-party cookie issues and the insecure workarounds developers resort to when iframes break

### What is validated

- **State parameter** — generated per login, validated on callback. Prevents CSRF attacks on the authorization flow.
- **Nonce** — bound to the ID token. If the ID token's `nonce` claim doesn't match the value sent during authorization, token parsing throws `NONCE_MISMATCH`. Prevents token replay.
- **PKCE (S256)** — every authorization request uses a code verifier + SHA-256 challenge. Prevents authorization code interception.
- **Discovery issuer** — `parseDiscoveryResponse` validates that the `issuer` field in the discovery document matches the expected issuer exactly. Prevents mix-up attacks.
- **Token response structure** — `parseTokenResponse` validates required fields and computes `expires_at` from the response. Malformed or error responses throw typed errors.

### What is not verified

- **JWT signatures** — tokens are decoded but not cryptographically verified. Per [OIDC Core 1.0 §3.1.3.7](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation), TLS validation may be used in place of signature verification when tokens are received directly from the token endpoint. If your application requires signature verification (e.g., server-side validation, zero-trust environments), validate tokens independently using the provider's JWKs.
- **Access token contents** — access tokens are treated as opaque strings. Server-side validation (introspection or signature verification) is the responsibility of your resource server.
- **`at_hash` / `c_hash` claims** — access token and code hash claims in the ID token are not validated.

### Threat Model

| Threat | Mitigation |
|--------|------------|
| CSRF on authorization flow | `state` parameter, validated on callback |
| Token replay | `nonce` bound to ID token, validated on exchange |
| Authorization code interception | PKCE with S256 challenge |
| Token leakage via storage | Tokens stored in memory only (not localStorage/sessionStorage). PKCE state uses sessionStorage during the redirect round-trip and is cleared immediately after callback processing. |
| XSS | Memory-only storage limits exfiltration surface. However, if your application is compromised by XSS, in-memory tokens are accessible to attacker scripts. XSS protection is your application's responsibility (CSP, input sanitization, framework protections). |
| IdP mix-up | Discovery issuer validation rejects mismatched issuers |

## Testing

The project has two layers of testing: unit tests for the functional core and each adapter, and E2E tests that run every adapter against a real OIDC identity provider.

### Unit tests

The functional core and every framework adapter have unit tests that validate protocol logic, state management, and component behavior with plain input/output — no mocked `fetch` or `window`.

```bash
pnpm -r test    # Run all unit tests
```

### E2E tests

**26 end-to-end tests** run real OIDC flows against a live [Autentico](https://github.com/eugenioenko/autentico) instance — no mocked endpoints, no simulated responses. Every test runs on all 8 framework adapters.

| Category | What's tested |
|----------|---------------|
| Login flow | Full lifecycle from unauthenticated state through login, token exchange, userinfo, refresh, and logout |
| Security | Nonce tampering, CSRF state mismatch, unique PKCE per login, tokens not in storage, concurrent tab isolation |
| RequireAuth | Route protection, auto-refresh on expired tokens, redirect on revoked refresh tokens |
| Edge cases | Concurrent refresh deduplication, revoked access token recovery, session loss on reload, multiple login/logout cycles |

Every test also asserts the exact sequence of OIDC network requests (`discovery → token → userinfo`) to catch regressions that UI-only assertions would miss — like a silent double-refresh or a missing discovery call.

The test harness is framework-agnostic: each adapter implements the same `data-testid` contract and runs the same Playwright spec. See [`tests/e2e/harness.md`](./tests/e2e/harness.md) for the full contract. A separate [stress workflow](./.github/workflows/e2e-stress.yml) runs the full suite repeatedly to surface race conditions and flaky tests.

### Why a dedicated test IdP

We use [Autentico](https://github.com/eugenioenko/autentico), a lightweight Go-based IdP built by the same team:

- **Fast startup (~500ms)** — enables per-run isolation with no shared state between test runs
- **Admin API** — test users, clients, and token lifetimes are configured programmatically, not through a UI
- **Deterministic** — no rate limits, no external dependencies, no flaky third-party auth servers

This testing strategy prioritizes determinism and reproducibility over provider diversity in CI. Provider compatibility is validated separately (see below).

### Provider Compatibility

| Provider | Status | Notes |
|----------|--------|-------|
| [Autentico](https://github.com/eugenioenko/autentico) | Full E2E | All 26 tests, all 8 adapters |
| Auth0 | Not tested | Planned |
| Keycloak | Not tested | Planned |
| AWS Cognito | Not tested | Planned |
| Azure AD / Entra ID | Not tested | Planned |
| Google | Not tested | Planned |
| Okta | Not tested | Planned |

The library follows the OIDC and OAuth 2.0 specifications closely (see [RFC Compliance](#rfc-compliance)). However, real-world providers may have non-standard behaviors or quirks. Testing against your specific provider before deploying to production is strongly recommended. If you've tested with a provider not listed here, contributions are welcome.

## Design Decisions

These are deliberate constraints, not missing features:

| Choice | Tradeoff |
|--------|----------|
| **Memory-only token storage** | Most secure for SPAs, but tokens are lost on page refresh. Apps must handle re-authentication or use refresh tokens. |
| **No JWT signature verification** | Spec-compliant ([OIDC Core §3.1.3.7](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)). Server-side verification belongs in the resource server. |
| **Core has no `fetch`** | Framework adapters control HTTP entirely — the core can't auto-discover or auto-refresh, adapters handle that orchestration. |
| **No iframe-based silent auth** | Uses refresh tokens instead. Avoids third-party cookie issues and iframe state management complexity. |
| **No silent login on load** | If tokens were lost (page refresh), the user must log in again. No invisible network requests or iframe hacks. |
| **Single test IdP for CI** | Optimizes for determinism and speed over multi-provider coverage. Compatibility relies on strict RFC adherence. |

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
        // Server returned an error
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
| `TOKEN_EXCHANGE_ERROR` | `parseTokenResponse`, `executeFetch` | Token endpoint error (includes IdP error code when available) |
| `AUTHORIZATION_ERROR` | `parseCallbackUrl` | Authorization server returned an error |
| `MISSING_REDIRECT_URI` | `buildAuthUrl` | `redirectUri` not set in config |
| `MISSING_CLIENT_SECRET` | `buildIntrospectRequest` | `clientSecret` required but not set |
| `USERINFO_ERROR` | `parseUserinfoResponse` | Malformed userinfo response or missing `sub` claim |
| `INTROSPECTION_ERROR` | `parseIntrospectResponse` | Malformed introspection response or missing `active` field |

## RFC Compliance

Every validation and return path in the source code is annotated with the specific RFC section it implements. The library conforms to:

- [RFC 6749](https://tools.ietf.org/html/rfc6749) — OAuth 2.0 Authorization Framework
- [RFC 7636](https://tools.ietf.org/html/rfc7636) — Proof Key for Code Exchange (PKCE)
- [RFC 7009](https://tools.ietf.org/html/rfc7009) — OAuth 2.0 Token Revocation
- [RFC 7662](https://tools.ietf.org/html/rfc7662) — OAuth 2.0 Token Introspection
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html)
- [OpenID Connect RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)

## Production Readiness Checklist

Before deploying to production, verify:

- [ ] Tested against your specific OIDC provider (discovery, login, token exchange, refresh, logout)
- [ ] HTTPS enforced in all environments (tokens travel over TLS)
- [ ] Refresh token rotation enabled at your IdP (prevents stolen refresh token reuse)
- [ ] `expiryBuffer` configured appropriately (default: 30 seconds)
- [ ] CSP headers configured (mitigates XSS, the primary threat to SPA token storage)
- [ ] `postLogoutRedirectUri` set correctly for your IdP
- [ ] Error handling implemented for `OidcError` codes your app may encounter
- [ ] Verified that `decodeJwtPayload` is not used for server-side trust decisions

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build core only
pnpm --filter oidc-js-core build

# Run unit tests
pnpm test

# Run E2E tests (sequential, all 8 frameworks)
pnpm test:e2e

# Run E2E tests in parallel (4 at a time)
MAX_PARALLEL=4 pnpm test:e2e

# Run E2E stress test (10x repetition per framework)
pnpm test:stress

# Type check
pnpm --filter oidc-js-core lint
```

### Tech Stack

- **pnpm workspaces** for monorepo management
- **TypeScript** in strict mode
- **Vite 8** library mode builds (dual ESM/CJS)
- **Vitest 4** test runner
- **Playwright** for E2E tests

## License

MIT
