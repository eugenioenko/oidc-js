# Decision Log

Architectural and design decisions for the oidc-js project. Each entry captures what was decided, alternatives considered, and the rationale. Serves as informal ADR and source material for articles.

### 001 - Pure functional core instead of class-based client (2026-04-30)

**Context**: The initial implementation used a class-based `OidcClient` that hardcoded `fetch` and managed state (discovery cache, token storage). This worked for React/browser but would force Angular users to abandon their `HttpClient` interceptor chain.

**Alternatives considered**:
1. Class-based client with pluggable `fetch` function via config
2. Pure functional core (build/parse functions, no IO)
3. Both layers: functional core + convenience client class on top

**Decision**: Pure functional core that never calls `fetch` or touches storage. Framework adapters compose core functions with their own HTTP and state management.

**Rationale**: The core is consumed by adapters, not end users. Nobody installs `oidc-js-core` directly in their app. Since every adapter needs its own HTTP layer (Angular uses `HttpClient`, React uses `fetch`), the core shouldn't pick one. Pure functions are also trivially testable with no mocking.

### 002 - Package naming: oidc-js-core for internals, oidc-js for the user-facing package (2026-04-30)

**Context**: Initially the core was published as `oidc-js`. But the core is an internal building block, not something users install directly. The name `oidc-js` should be the package people search for and use.

**Alternatives considered**:
1. `oidc-js` = core, `oidc-js-vanilla` = fetch-based client
2. `oidc-js` = core, `oidc-js-fetch` = fetch-based client
3. `oidc-js-core` = core, `oidc-js` = fetch-based convenience client

**Decision**: Option 3. `oidc-js-core` is the functional internals. `oidc-js` is the user-facing package with `fetch` + `sessionStorage`.

**Rationale**: `oidc-js` is what people search for on npm. It should be the usable thing, not the plumbing. `oidc-js-core` clearly signals "you probably want a higher-level package."

### 003 - Flat config instead of discriminated union for public/confidential clients (2026-04-30)

**Context**: Needed to support both public clients (SPAs, no secret) and confidential clients (Node APIs, with secret). Considered type-level enforcement to prevent misuse.

**Alternatives considered**:
1. Discriminated union: `{ clientType: "public" } | { clientType: "confidential", clientSecret: string }`
2. Nested object: `{ client: { type: "public", redirectUri } | { type: "confidential", clientSecret } }`
3. Flat config: `{ clientId, clientSecret?, redirectUri? }`

**Decision**: Flat config with optional fields.

**Rationale**: The discriminated union and nested object both add ceremony for a problem that doesn't exist in practice. Nobody accidentally makes a public client confidential. The type-level safety sounds good but adds unwrapping overhead everywhere. Functions validate what they need at the call site: `buildAuthUrl` throws if `redirectUri` is missing, `buildIntrospectRequest` throws if `clientSecret` is missing.

### 004 - Throw OidcError instead of result types (2026-04-30)

**Context**: Considered returning `{ success, error }` objects or `[error, data]` tuples instead of throwing, to make error handling explicit.

**Alternatives considered**:
1. Result objects: `{ success: true, data } | { success: false, error }`
2. Go-style tuples: `[error, data]`
3. Throw `OidcError` with typed error codes

**Decision**: Throw `OidcError` with a `code` field.

**Rationale**: Result types fight the language. `fetch` throws, `JSON.parse` throws, `crypto.subtle` throws. The core would internally try/catch everything just to wrap it. Async functions already need try/catch for rejected promises, so result types mean handling errors two ways. Only ~5 of 22 functions can meaningfully error (the parse functions). Custom error with typed codes gives adapters enough info to switch on `e.code` without the overhead.

### 005 - Vite 8 + Vitest 4 instead of tsup + esbuild (2026-04-30)

**Context**: Initial setup used tsup (esbuild) for builds and vitest for tests. Since vitest depends on vite, we had two build engines.

**Alternatives considered**:
1. tsup + vitest (esbuild for build, vite for test)
2. vite + vitest (vite for both)

**Decision**: Vite 8 library mode for builds, Vitest 4 for tests.

**Rationale**: One toolchain instead of two. Vite 8 is fast, handles dual ESM/CJS output, and `vite-plugin-dts` generates declarations. Fewer dependencies, simpler config.

### 006 - ESLint 10 instead of Biome (2026-04-30)

**Context**: Needed a linter for the monorepo. Biome is faster and simpler for pure TypeScript, but the project will have React, Angular, Vue, Svelte, and Solid packages.

**Alternatives considered**:
1. Biome (fast, zero config, but limited Angular/Vue support)
2. ESLint 10 with typescript-eslint (ecosystem support for all frameworks)

**Decision**: ESLint 10 with flat config and typescript-eslint.

**Rationale**: The core is functional, but framework packages will have JSX components, Angular decorators, Vue SFCs. Each framework has lint rules that matter (react-hooks, angular-eslint, etc.). One linter across the whole monorepo is simpler than maintaining Biome for core + ESLint for frameworks.

### 007 - RFC annotations in source and tests (2026-04-30)

**Context**: As authors of both the IdP (Autentico) and the client library, we have deep knowledge of the OIDC specs. Wanted to preserve that knowledge in the code.

**Decision**: Every validation check and return path has an inline comment referencing the spec section: `// RFC NNNN §X.Y: description`. Tests quote the RFC section in test names. RFC source documents stored in `rfc/`.

**Rationale**: Makes the code self-documenting for spec compliance. Reviewers can verify correctness against the RFC. Matches the pattern used in Autentico's Go codebase.

### 008 - useAuth() returns flat state + grouped tokens and actions (2026-04-30)

**Context**: Needed to design the `useAuth()` hook return shape. Every field at the top level makes destructuring noisy and mixes read-only state with imperative functions.

**Alternatives considered**:
1. Flat: `{ user, isAuthenticated, accessToken, login, logout, refresh }`
2. Fully grouped: `{ state: {...}, actions: {...} }`
3. Hybrid: flat state + grouped `tokens` + grouped `actions`

**Decision**: Hybrid. State fields (`user`, `isAuthenticated`, `isLoading`, `error`, `config`) at top level, tokens grouped under `tokens`, functions grouped under `actions`.

**Rationale**: State fields are read frequently and benefit from direct destructuring. Tokens are a natural group (access, id, refresh). Actions are imperative and group logically. The `tokens.refresh` / `actions.refresh()` name collision is fine since they're in different groups and nobody destructures both flat.

### 009 - user.claims + user.profile separation (2026-04-30)

**Context**: After login, user info comes from two sources: the ID token (always available, has required claims like sub, iss, aud, exp, iat) and the userinfo endpoint (richer profile, varies by IdP and scopes requested).

**Alternatives considered**:
1. Single `user: OidcUser` merged from both sources
2. `user.claims` (ID token) + `user.profile` (userinfo), separate types

**Decision**: Option 2. `user.claims` is `IdTokenClaims` (always set after login), `user.profile` is `OidcUser | null` (null until fetched).

**Rationale**: Clear separation of what's guaranteed vs what depends on the IdP. `user.claims.sub` is always there. `user.profile` depends on scopes, IdP configuration, and whether the app opts in via `fetchProfile`. No ambiguity about where data came from.

### 010 - fetchProfile prop on AuthProvider, default true (2026-04-30)

**Context**: The userinfo endpoint provides richer user data than ID token claims, but it's an extra HTTP request. Some apps only need the sub claim.

**Alternatives considered**:
1. Always fetch userinfo (like oidc-client-ts)
2. Never fetch, provide `actions.fetchProfile()` only
3. `fetchProfile` prop, default `true`, with manual `actions.fetchProfile()` available either way

**Decision**: Option 3. Default `true` since most apps need name/email for UI. Apps that don't can set `fetchProfile={false}`.

**Rationale**: Opt-out is better than opt-in here. Most React apps display the user's name or email somewhere. One extra request during login is negligible. The manual `actions.fetchProfile()` is always available for apps that fetch it lazily or conditionally.

### 011 - Tokens in memory, PKCE state in sessionStorage (2026-04-30)

**Context**: Need to store tokens after login and PKCE parameters during the redirect round-trip.

**Decision**: Tokens (access, id, refresh) stored in React state only. PKCE verifier, state, and nonce stored in sessionStorage during the redirect, cleared immediately after callback processing.

**Rationale**: Memory-only tokens are the most secure option for SPAs (no XSS exfiltration from storage). PKCE state must survive a full page navigation (redirect to IdP and back), so sessionStorage is the only viable option. It's cleared as soon as the callback is processed.

### 012 - RequireAuth checks access token `exp` claim, not just `isAuthenticated` boolean (2026-04-30)

**Context**: RequireAuth initially only checked the `isAuthenticated` boolean from context. This meant an expired access token was invisible to the component — a user who left a tab open for hours would see stale "authenticated" UI until something explicitly set `isAuthenticated` to false.

**Alternatives considered**:
1. Check only `isAuthenticated` boolean (original behavior)
2. Decode JWT and check `exp` on every render
3. Decode `exp` once when tokens arrive, store `expiresAt` in state, compare on render

**Decision**: Option 3. AuthProvider decodes `exp` from the access token once during token exchange and stores `tokens.expiresAt` (milliseconds since epoch). RequireAuth compares `expiresAt` to `Date.now()` — if expired, it triggers auto-refresh (if enabled) before showing children.

**Rationale**: Option 2 decodes a JWT on every render, which is wasteful. `expiresAt` is derived once and stored alongside the tokens. The expiry check is a simple number comparison: `isExpired = expiresAt !== null && expiresAt <= Date.now()`.

**Update (2026-05-01)**: The initial implementation used `useMemo` with `[isAuthenticated, tokens.expiresAt]` deps. This is fundamentally broken for time-dependent checks — `Date.now()` is not a React dependency, so when navigating between protected pages (neither dep changes), `useMemo` returns a stale cached result. Fix: compute `isExpired` directly on every render (no `useMemo`). A number comparison per render is negligible.

### 013 - `tokens.expiresAt` naming over `tokens.accessExpiresAt` (2026-04-30)

**Context**: The `AuthTokens` type groups `access`, `id`, `refresh`, and the expiration timestamp. The timestamp is derived from the access token's `exp` claim.

**Alternatives considered**:
1. `accessExpiresAt` — explicit about which token
2. `expiresAt` — shorter, relies on context

**Decision**: `expiresAt`. Inside the `tokens` object, the fields `access`, `id`, `refresh` already establish that this is token-related. `accessExpiresAt` is redundant — like `user.userName`. If we ever need refresh token expiration, it can be `refreshExpiresAt` while `expiresAt` stays as the primary (access token) expiration.

### 014 - `onLogin(returnTo)` callback for post-login navigation (2026-04-30)

**Context**: After OAuth callback, the library needs to navigate the user back to the page they were on before login. With memory-only tokens, the full page reload during the redirect wipes React state, so the library can't rely on in-memory state for the return URL.

**Alternatives considered**:
1. `onLogin({ returnTo, user })` — structured object with user info for routing decisions (Auth0 pattern)
2. `onLogin(returnTo: string)` — just the URL string
3. `onRedirectCallback(appState)` — extensible app state object (Auth0's `appState` pattern)
4. No callback, always `replaceState` (oidc-client-ts default)

**Decision**: `onLogin(returnTo: string)` prop on AuthProvider. `returnTo` is automatically captured from `window.location.href` when `actions.login()` is called, saved in sessionStorage alongside PKCE state, and passed to the callback after token exchange. Default when no `onLogin` provided: `window.history.replaceState({}, "", returnTo)`.

**Rationale**: Passing `user` in the callback was considered, but `onLogin` runs inside AuthProvider before context propagates to children — so `useAuth()` isn't available there anyway. User-dependent routing decisions belong in child components via `useAuth()`, not in the provider callback. A plain string keeps the API simple and router-agnostic. Override with `actions.login({ returnTo: "/custom" })`.

### 015 - E2E test harness with Autentico as real OIDC IdP (2026-04-30)

**Context**: Needed E2E tests that verify the full OIDC flow (redirect, login, callback, token exchange, refresh, logout) against a real identity provider, not mocks.

**Alternatives considered**:
1. Mock the IdP endpoints in the test
2. Use a third-party test IdP service
3. Use Autentico (our own IdP) as a real test server

**Decision**: Option 3. Playwright global-setup downloads the Autentico release binary, initializes a fresh instance, creates test users and clients via the admin API, and tears it down after tests. The harness lives in `tests/e2e/` with the backend setup shared across framework adapters.

**Rationale**: We control both sides of the OIDC flow. Mocking the IdP defeats the purpose of E2E tests. Using our own IdP means we can configure it exactly as needed (CORS, token expiration, client settings) via the admin API. The test app for each framework adapter is separate, but the Autentico setup is identical.

### 016 - Clock manipulation for RequireAuth auto-refresh E2E test (2026-04-30, updated 2026-05-01)

**Context**: Needed to test that RequireAuth automatically refreshes an expired access token when navigating between protected pages. The challenge is triggering token expiration deterministically without flaky timing.

**Alternatives considered**:
1. `page.evaluate()` to corrupt the access token in React state — deterministic but couples test to internals
2. Expose a test hook on AuthProvider — compromises library API security
3. Short access token TTL (1s) via per-client override, wait 5s — simple, wide margin
4. Revoke access token server-side — client doesn't know it's revoked
5. Override `Date.now` in the browser via `page.evaluate` to jump past `expiresAt`

**Decision**: Option 5. After login, read `tokens.expiresAt` from the page, then `page.evaluate(() => { Date.now = () => expiresAt + 1000 })`. RequireAuth sees the token as expired instantly — no wait, no short TTL.

**Rationale**: The original approach (option 3) failed on slow CI — with a 1-3s TTL, the token expired during the login flow itself before the test reached the expiration check. Clock manipulation is instant and deterministic regardless of CI speed. It only affects the browser's `Date.now`, not the Autentico server clock, so the server still issues fresh tokens with real timestamps. The refreshed token appears valid because its `exp` is 15 minutes from real server time, which is far ahead of our faked `Date.now` (only 1s past the old token's expiry).

### 017 - Token expiration buffer on AuthProvider (2026-04-30)

**Context**: RequireAuth compares `tokens.expiresAt` to `Date.now()` to detect expired tokens. An exact comparison creates a race: a request can go out with a token that expires mid-flight.

**Decision**: Add `tokenExpirationBuffer` prop on AuthProvider (default 30 seconds). RequireAuth treats the token as expired `buffer` seconds before actual expiration: `expiresAt - buffer > Date.now()`.

**Rationale**: 30s default is conservative enough to cover most request round-trips without triggering unnecessary refreshes. Configurable for apps with different needs (long-running uploads, real-time connections).

### 018 - `onError` callback on AuthProvider (2026-04-30)

**Context**: When token exchange or discovery fails during the redirect callback, the library sets `error` state. Apps may want to handle errors externally (logging, analytics, error reporting) without watching state changes.

**Decision**: Add `onError(error: Error)` prop on AuthProvider. Called when discovery, token exchange, or refresh fails. Does not replace the `error` state — both fire.

**Rationale**: Mirrors the `onLogin` pattern. Auth0 passes errors to its callback too. Separating error handling from rendering keeps components focused on UI while infrastructure concerns (logging, reporting) live at the provider level.

### 019 - Callback detection is URL-agnostic, no dedicated callback route needed (2026-04-30)

**Context**: After the IdP redirects back with `code` and `state` params, the library needs to detect and process the callback. Some libraries require a dedicated `/callback` route component.

**Alternatives considered**:
1. Require a `<CallbackHandler>` component at a specific route
2. Match current URL against `redirectUri` before processing
3. Detect `code` + `state` params anywhere, validate against saved session state

**Decision**: Option 3. AuthProvider checks for `code` and `state` query params on mount regardless of the current path. It validates `state` against the value saved in sessionStorage during login — only a matching state triggers callback processing.

**Rationale**: No extra route setup, no callback component, works with any router or no router. The `state` validation prevents false positives — random query params won't trigger processing. The `redirectUri` in config is purely for the IdP ("where to send the browser"), not for the library. This is the same approach Auth0 uses.

### 020 - Vanilla JS orchestration layer (`oidc-js`) reused by all framework adapters except Angular (2026-04-30)

**Context**: The React adapter (`oidc-js-react`) wires together `oidc-js-core` functions with `fetch`, `AbortController`, `sessionStorage`, and state management. Vue, Svelte, and Solid adapters would need the same IO orchestration with different reactivity primitives.

**Alternatives considered**:
1. Each framework adapter directly imports `oidc-js-core` and re-implements the fetch/storage/callback orchestration
2. Build a vanilla JS client (`oidc-js`) that handles discovery, login redirect, callback processing, token refresh, and logout — framework adapters wrap it with their reactivity system
3. Same as 2 but include Angular

**Decision**: Option 2. Build `oidc-js` as a stateful vanilla client on top of `oidc-js-core`. React, Vue, Svelte, and Solid adapters consume it. Angular gets its own adapter using `oidc-js-core` directly since it needs Angular's `HttpClient` and dependency injection patterns.

**Rationale**: The orchestration logic (discovery fetch, PKCE round-trip, callback detection, token refresh) is identical across frameworks — only the reactivity layer differs. A shared vanilla client eliminates duplication and ensures consistent behavior. Angular is excluded because it has its own HTTP layer (`HttpClient` with interceptors), dependency injection, and idiomatic patterns that don't map well to a `fetch`-based vanilla client.

### 021 - Shared E2E test specs with per-framework test apps (2026-04-30)

**Context**: Every framework adapter needs E2E tests covering the same OIDC flows: login, logout, token display, profile fetch, RequireAuth, refresh. Writing separate Playwright specs per framework would duplicate test logic.

**Alternatives considered**:
1. Copy-paste specs per framework, adjust selectors
2. Shared Playwright specs with a contract: all test apps use the same `data-testid` attributes and expose the same UI surface
3. Abstract test helpers but keep separate spec files

**Decision**: Option 2. One set of Playwright specs in `tests/e2e/specs/`. Each framework has its own test app (e.g., `tests/e2e/react-app/`, `tests/e2e/vue-app/`) that implements the same `data-testid` contract. The Playwright config or CI matrix selects which app to run against.

**Rationale**: The tests verify OIDC behavior, not framework rendering. If a test app shows `data-testid="user-sub"` with the user's sub claim and `data-testid="login-button"` to trigger login, the Playwright spec doesn't care whether it's React or Svelte underneath. One spec suite, many apps, same contract.

### 022 - `loginOptions` prop on RequireAuth (2026-05-01)

**Context**: RequireAuth calls `actions.login()` when a user isn't authenticated (or when auto-refresh fails). Some IdPs support extra parameters on the authorize URL — e.g., `prompt=login` to force re-authentication, `login_hint` to pre-fill the username, or custom parameters.

**Alternatives considered**:
1. RequireAuth always calls `actions.login()` with no options — apps that need custom params must build their own guard
2. `loginOptions` prop on RequireAuth, forwarded to `actions.login(loginOptions)`

**Decision**: Option 2. RequireAuth accepts an optional `loginOptions` prop (same `LoginOptions` type used by `actions.login()`), forwarded when triggering a login redirect.

**Rationale**: Simple pass-through, no new types. Apps that don't need it ignore the prop. Apps that do (e.g., forcing `prompt=login` on sensitive pages) get it without reimplementing the auth guard.

### 023 - E2E traffic auditing: separate fetch tracking from navigation tracking (2026-05-01)

**Context**: E2E tests need to verify that the OIDC flow makes exactly the expected protocol requests (discovery, token exchange, userinfo) and page navigations (authorize redirect, logout redirect). Initially both were tracked in a single log.

**Alternatives considered**:
1. Single combined log of all requests, assert order and type together
2. Separate tracking: `fetch`/`xhr` requests in one log, `document` navigations in another, assert independently

**Decision**: Option 2. `trackTraffic(page)` returns `{ requests(), navigations() }`. Requests are captured via `page.on("request")` filtered to `resourceType === "fetch" | "xhr"`. Navigations are captured via `page.on("request")` filtered to `resourceType === "document"`. Both filter to OIDC-relevant paths only.

**Rationale**: Fetch requests and full-page navigations are fundamentally different — mixing them creates race condition risks since a navigation triggers multiple events (request, response, `framenavigated`). Separate tracking makes assertions clear: `LOGIN_REQUESTS` for protocol calls, `LOGIN_NAVIGATIONS` for redirects. Constants like `DISCOVERY` and `LOGIN_REQUESTS` keep assertions DRY across tests.

### 024 - Atomic state updates via framework batching, not single-object signal (2026-05-02)

**Context**: All framework adapters store auth state as separate reactive primitives (one signal/store/ref per field: `user`, `isAuthenticated`, `isLoading`, `error`, `tokens`). The Kasper adapter exposed a tearing bug: writing five signals sequentially without `batch()` caused effects to fire between writes, seeing inconsistent intermediate state. This triggered a logout→login race and a double-navigation bug.

**Alternatives considered**:
1. Single state object signal — one write, one effect flush, no tearing possible
2. Separate signals with `batch()` to group writes atomically

**Decision**: Option 2 across all adapters. Kasper explicitly uses `batch()` in its subscriber. Other frameworks handle this implicitly (React 18+ auto-batches, Solid batches within effects, Svelte 5 batches rune updates).

**Rationale**: A single object signal eliminates tearing by design but sacrifices granularity — every state change notifies all consumers. For auth state (changes 2-3 times per session), the granularity win is negligible and wasn't worth the added complexity of the fix. However, separate signals map naturally to each framework's idiomatic reactivity primitive and preserve fine-grained updates for frameworks where it matters (Solid, Svelte). The real lesson: when bridging a subscribe-based state source into a signal system, always batch the writes. This is not Kasper-specific — any framework with synchronous or microtask-flushed effects needs atomic grouped updates from external state sources.

### 025 - Defer Ember adapter, ship 7 frameworks (2026-05-01)

**Context**: Built framework adapters for Vue, Svelte, Angular, Solid, Preact, and Lit. An Ember Octane adapter was also built and has a working E2E test app, but the PR adds ~10k lines due to Ember's lockfile and build tooling.

**Alternatives considered**:
1. Merge the Ember adapter alongside the others
2. Keep the Ember PR open but don't merge, ship 7 frameworks without Ember
3. Drop Ember entirely

**Decision**: Option 2. Ship React, Vue, Svelte, Angular, Solid, Preact, and Lit. The Ember PR stays open for future consideration.

**Rationale**: Ember's ecosystem adds significant weight (lockfile, ember-cli build, @glimmer dependencies) for a framework with declining adoption. The adapter works and the PR is ready, but merging it increases maintenance burden and CI time disproportionately. Keeping it open preserves the work without committing to maintenance.
