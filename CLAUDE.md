# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oidc-js is a zero-dependency OIDC (OpenID Connect) client library for JavaScript/TypeScript. The repo is a pnpm monorepo with a purely functional core (`oidc-js-core`) and framework-specific adapter packages. The core performs no IO — it builds requests and parses responses. Adapters compose core functions with their own HTTP layer and storage.

## Commands

```bash
pnpm install                            # Install all workspace dependencies
pnpm build                              # Build all packages
pnpm --filter oidc-js-core build        # Build core only
pnpm --filter oidc-js-core test         # Test core only
pnpm --filter oidc-js-core lint         # Type-check core only
pnpm --filter oidc-js-react build       # Build react only
```

## Architecture

### Package hierarchy

```
oidc-js-core          → Pure functions, no IO, no state, no fetch. Web Crypto API only.
oidc-js               → Convenience client: core + fetch + sessionStorage (not yet implemented)
oidc-js-react         → core + fetch + React context/hooks (needs update for new core)
oidc-js-angular       → core + HttpClient + Angular service/guard (placeholder)
oidc-js-vue           → core + fetch + Vue composables (placeholder)
oidc-js-svelte        → core + fetch + Svelte stores (placeholder)
oidc-js-solid         → core + fetch + Solid signals (placeholder)
```

### Core package (`packages/core/src/`)

Purely functional — every function takes data in and returns data out. No `fetch`, no storage, no side effects.

- **`errors.ts`** — `OidcError` class with typed `OidcErrorCode` (never generic Error throws)
- **`types.ts`** — All interfaces: `OidcConfig`, `OidcDiscovery`, `TokenResponse`, `TokenSet`, `AuthState`, `OidcUser`, `HttpRequest`, `IntrospectionResponse`
- **`crypto.ts`** — PKCE generation (`generatePkce`, `computeCodeChallenge`), random values (`generateState`, `generateNonce`), base64url encode/decode
- **`discovery.ts`** — `buildDiscoveryUrl`, `parseDiscoveryResponse` (validates issuer match + required fields)
- **`authorize.ts`** — `buildAuthUrl` (constructs authorization URL with PKCE), `parseCallbackUrl` (validates state, extracts code)
- **`token.ts`** — `buildTokenRequest`, `buildRefreshRequest` (return `HttpRequest` with headers/body), `parseTokenResponse` (validates nonce, computes `expires_at`)
- **`userinfo.ts`** — `buildUserinfoRequest`, `parseUserinfoResponse`
- **`introspect.ts`** — `buildIntrospectRequest` (requires clientSecret), `parseIntrospectResponse`
- **`revocation.ts`** — `buildRevocationRequest` (returns null if no endpoint)
- **`logout.ts`** — `buildLogoutUrl` (returns null if no end_session_endpoint)
- **`jwt.ts`** — `decodeJwtPayload`, `parseIdTokenClaims` (decode only, no signature verification)
- **`token-utils.ts`** — `computeExpiresAt`, `isTokenExpired`, `timeUntilExpiry`

### Config model

Flat config, public and confidential clients use the same type:
- Public client: `clientId` + `redirectUri`, no `clientSecret`
- Confidential client: `clientId` + `clientSecret`, `redirectUri` optional
- Functions that need `clientSecret` (introspect) throw `MISSING_CLIENT_SECRET` if absent
- Functions that need `redirectUri` (buildAuthUrl) throw `MISSING_REDIRECT_URI` if absent

### Error handling

All errors throw `OidcError` with a typed `code` field. No generic throws. Error codes: `DISCOVERY_INVALID`, `DISCOVERY_ISSUER_MISMATCH`, `STATE_MISMATCH`, `NONCE_MISMATCH`, `MISSING_AUTH_CODE`, `INVALID_JWT`, `TOKEN_EXCHANGE_ERROR`, `AUTHORIZATION_ERROR`, `MISSING_REDIRECT_URI`, `MISSING_CLIENT_SECRET`.

### Build

Core uses **Vite 8** (library mode) for dual ESM/CJS output with `vite-plugin-dts` for declarations. Tests use **Vitest 4**. Shared TypeScript config in root `tsconfig.base.json`.

### RFC compliance

Every validation check and return path has an inline RFC annotation: `// RFC NNNN §X.Y: description`. RFC source documents are in `rfc/`. Tests quote the RFC section being validated in test names.

## Decision Log

After every merged PR that involves a design or architectural decision, update `decisions.md` at the repo root. Each entry should capture what was decided, what alternatives were considered, and why the chosen approach won. This serves as an informal ADR (Architecture Decision Record) and as source material for future articles.

Format:
```
### NNNN - Title (YYYY-MM-DD)

**Context**: what prompted the decision
**Alternatives considered**: what else was on the table
**Decision**: what we chose
**Rationale**: why
```

## Design Principles

- **Zero dependencies** in core — only Web Crypto API
- **Pure functions** — core never calls fetch or touches storage
- **Functional core, imperative shell** — adapters handle IO, core handles logic
- Core works in any JS runtime (browser, Node, Deno, Bun, Workers)
- Supports both public clients (SPAs) and confidential clients (Node APIs)
