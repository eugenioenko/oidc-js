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
