# Adding a New Framework Adapter

Step-by-step workflow for adding a new framework adapter to oidc-js. Follow each phase in order. The React adapter (`packages/react`) and its test app (`tests/e2e/react-app`) are the reference implementation.

## Phase 1: Scaffold the adapter package

Create `packages/<framework>/` with the following structure:

```
packages/<framework>/
  src/
    index.ts          # public exports
    types.ts          # framework-specific types
    ...               # framework-specific files (provider, hooks, guards, etc.)
  package.json
  tsconfig.json
  vite.config.ts
```

### package.json

- Name: `oidc-js-<framework>`
- Dependencies: `oidc-js` (workspace:\*), `oidc-js-core` (workspace:\*)
- Peer dependency: the framework itself (e.g. `vue >= 3.0.0`)
- Scripts: `build`, `test`, `lint`
- Dual ESM/CJS output with types

Use `packages/react/package.json` as template. Adjust the framework peer dependency and keywords.

### vite.config.ts

Library mode build with `vite-plugin-dts`. Mark the framework and `oidc-js`/`oidc-js-core` as external in rollupOptions.

### tsconfig.json

Extend `../../tsconfig.base.json`. Set `lib` to include `DOM` if the adapter runs in browsers.

### tsconfig.typedoc.json

TypeDoc runs from the `docs-web` directory and cannot resolve workspace imports like `oidc-js-core` or `oidc-js` via node_modules. Create a separate `tsconfig.typedoc.json` that adds `paths` mappings and removes `rootDir`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "lib": ["ES2022", "DOM"],
    "paths": {
      "oidc-js-core": ["../core/src/index.ts"],
      "oidc-js": ["../client/src/index.ts"]
    }
  },
  "include": ["src"],
  "exclude": ["src/tests"]
}
```

This file is only used by the TypeDoc plugin in `docs-web/astro.config.mjs`. The normal build uses `tsconfig.json`.

## Phase 2: Implement the adapter

The adapter wraps `OidcClient` from `oidc-js` in framework-native patterns. Every adapter must expose:

### Required exports

| Export | Type | Purpose |
|---|---|---|
| Provider/Plugin | Component or plugin | Wraps app, creates `OidcClient`, handles callback |
| Auth accessor | Hook/composable/service | Returns auth state: `user`, `isAuthenticated`, `isLoading`, `error`, `tokens`, `actions` |
| Auth guard | Component or guard | Protects routes, auto-refreshes expired tokens, redirects to login |

### Provider responsibilities

1. Accept an `OidcConfig` and optional `fetchProfile` boolean
2. Create an `OidcClient` instance and call `client.init()` on mount
3. Subscribe to `OidcClient` state changes and bridge them into the framework's reactivity
4. Handle the `onLogin` callback (restore `returnTo` URL via the framework's router)
5. Handle the `onError` callback
6. Call `client.destroy()` on unmount/teardown

### Auth accessor return shape

```typescript
{
  config: OidcConfig;
  user: AuthUser | null;       // { claims: IdTokenClaims, profile: OidcUser | null }
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  tokens: AuthTokens;          // { access, id, refresh, expiresAt }
  actions: {
    login(options?: LoginOptions): void;
    logout(): void;
    refresh(): Promise<void>;
    fetchProfile(): Promise<void>;
  };
}
```

### Auth guard behavior

1. If loading, show fallback
2. If authenticated and token not expired, render content
3. If token expired and `autoRefresh` is true, call `actions.refresh()`
4. If refresh fails (or no refresh token), call `actions.login()`
5. Preserve current URL as `returnTo` for deep linking

### Re-export core types

The adapter should re-export commonly used types so users don't need to install `oidc-js-core` directly:

```typescript
export type { OidcConfig, OidcUser, TokenSet } from "oidc-js-core";
```

## Phase 3: Add TSDoc comments

Add TSDoc comments to every exported function, class, component, interface, and type. Follow these rules:

- Use `/** ... */` TSDoc style
- Add `@param` and `@returns` tags to functions
- Add `@throws` tags where applicable
- Add inline `/** ... */` descriptions on interface properties
- Reference relevant OIDC/OAuth RFCs where appropriate
- No em dashes
- Keep comments concise (one or two sentences per description)

Run `pnpm --filter oidc-js-<framework> lint` to verify type-checking still passes.

## Phase 4: Create the E2E test app

Create `tests/e2e/<framework>-app/` that renders the same UI surface as the React test app. This is the contract. The Playwright specs don't know or care which framework renders the page -- they only interact with `data-testid` attributes.

### Required data-testid attributes

The test app MUST expose these exact `data-testid` values. The Playwright specs depend on them.

**Loading/error states:**
- `auth-loading` -- shown while `isLoading` is true
- `auth-error` -- shown when `error` is set, text must contain `error.message`

**Unauthenticated state:**
- `unauthenticated` -- container shown when not logged in
- `login-button` -- triggers `actions.login()` on click

**Authenticated state:**
- `authenticated` -- container shown when logged in
- `user-sub` -- text content: `user.claims.sub`
- `user-iss` -- text content: `user.claims.iss`
- `user-aud` -- text content: `user.claims.aud` (stringified if array)
- `user-exp` -- text content: `user.claims.exp`
- `user-iat` -- text content: `user.claims.iat`
- `user-email` -- text content: `user.profile?.email ?? "no profile"`
- `user-profile-null` -- text content: `"true"` or `"false"`
- `access-token` -- text content: `"present"` or `"missing"`
- `refresh-token` -- text content: `"present"` or `"missing"`
- `access-token-value` -- hidden element with raw access token
- `refresh-token-value` -- hidden element with raw refresh token
- `id-token` -- text content: `"present"` or `"missing"`
- `expires-at` -- text content: `tokens.expiresAt ?? "none"`
- `logout-button` -- triggers `actions.logout()` on click
- `refresh-button` -- triggers `actions.refresh()` on click

**Navigation links:**
- `link-protected-a` -- navigates to `/protected-a`
- `link-protected-b` -- navigates to `/protected-b`
- `link-home` -- navigates to `/` (shown on protected pages)

**Protected pages:**
- `protected-a` -- content rendered inside auth guard on `/protected-a`
- `protected-b` -- content rendered inside auth guard on `/protected-b`

### Routes

The test app must define these routes:

| Path | Component | Notes |
|---|---|---|
| `/` | Home page | Shows login or authenticated state |
| `/callback` | Callback page | Shows loading indicator |
| `/protected-a` | Protected page A | Wrapped in auth guard |
| `/protected-b` | Protected page B | Wrapped in auth guard |

### fetchProfile toggle

The test app must read `localStorage.getItem("e2e-fetchProfile")` at startup. If the value is `"false"`, pass `fetchProfile={false}` to the provider. This allows the spec to test both modes.

### Config

```javascript
{
  issuer: "http://localhost:9999/oauth2",
  clientId: "e2e-test-app",
  redirectUri: "http://localhost:5173/callback",
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: "http://localhost:5173",
}
```

### onLogin handler

The provider must accept an `onLogin` callback and use the framework's router to navigate to the `returnTo` URL (using `replace`, not `push`).

### Dev server

The test app must serve on `http://localhost:5173` via `pnpm dev`. Add it as a workspace package in `pnpm-workspace.yaml`.

## Phase 5: Wire up the E2E harness

The Playwright specs in `tests/e2e/specs/` are shared across all framework test apps. Each framework gets its own Playwright config that points to its test app.

### Create a Playwright config

Create `tests/e2e/playwright.<framework>.config.ts`:

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./specs",
  timeout: 30_000,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  globalSetup: "./global-setup.ts",
  globalTeardown: "./global-teardown.ts",
  webServer: {
    command: "pnpm --dir <framework>-app dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
```

### Add test scripts

In `tests/e2e/package.json`, add a script for the new framework:

```json
{
  "scripts": {
    "test": "playwright test",
    "test:react": "playwright test --config=playwright.react.config.ts",
    "test:<framework>": "playwright test --config=playwright.<framework>.config.ts"
  }
}
```

### Rename the existing config

On the first non-React adapter, rename `playwright.config.ts` to `playwright.react.config.ts` and update the default `test` script to run all configs, or keep it as the default.

## Phase 6: Add to CI

Update `.github/workflows/ci.yml` to build and test the new adapter:

1. The `pnpm build` step already builds all packages
2. Add an E2E test step for the new framework:

```yaml
- name: E2E tests (<framework>)
  run: pnpm --filter e2e-tests test:<framework>
```

## Phase 7: Add to docs

1. Add the adapter to the `docs-web/astro.config.mjs` sidebar
2. Create hand-written guide pages in `docs-web/src/content/docs/<framework>/`
3. Add a TypeDoc plugin instance for the adapter in `astro.config.mjs`:

```javascript
starlightTypeDoc({
  entryPoints: ['../packages/<framework>/src/index.ts'],
  tsconfig: '../packages/<framework>/tsconfig.typedoc.json',
  output: 'api/<framework>',
  sidebar: {
    label: 'API Reference (<Framework>)',
    collapsed: true,
  },
  typeDoc: {
    excludePrivate: true,
    excludeInternal: true,
  },
}),
```

4. Update the package table on the docs splash page (`index.mdx`) to mark the adapter as stable

## Phase 8: Update decisions.md

Add an entry to `decisions.md` at the repo root documenting any design decisions made during the adapter implementation. Note framework-specific trade-offs (e.g., how state reactivity was bridged, router integration approach).

## Framework Interface Reference

Each framework maps the provider/consumer/guard pattern differently. This section shows the expected API surface for each supported framework.

### Summary

| | Provider | Consume auth | Guard | Reactivity |
|---|---|---|---|---|
| React | `<AuthProvider>` component | `useAuth()` hook | `<RequireAuth>` component | `useState` + subscribe |
| Vue | `app.use(oidcPlugin)` plugin | `useAuth()` composable | `router.beforeEach` navigation guard | `ref()` / `reactive()` |
| Svelte | `<AuthProvider>` component (setContext) | `getAuthContext()` | `<RequireAuth>` component | `$state` runes |
| Angular | `provideAuth()` in app config | `inject(AuthService)` | `canActivate` route guard | `BehaviorSubject` or signals |
| Solid | `<AuthProvider>` component | `useAuth()` accessor | `<RequireAuth>` component | `createSignal` |
| Preact | `<AuthProvider>` component | `useAuth()` hook | `<RequireAuth>` component | `useState` + subscribe |
| Lit | `AuthController` reactive controller | `this.auth` from controller | `<require-auth>` custom element | `ReactiveController` + `requestUpdate` |
| Ember | `oidc` service | `@service oidc` injection | `authenticated` route mixin or decorator | tracked properties (`@tracked`) |

### React

```tsx
// Provider
<AuthProvider config={config} onLogin={({ returnTo }) => navigate(returnTo, { replace: true })}>
  <App />
</AuthProvider>

// Consumer
const { user, isAuthenticated, isLoading, error, tokens, actions } = useAuth();

// Guard
<RequireAuth fallback={<Loading />}>
  <ProtectedContent />
</RequireAuth>
```

### Vue

```vue
<!-- Provider: installed as plugin in main.ts -->
<script>
app.use(oidcPlugin, {
  config: { issuer, clientId, redirectUri, scopes },
  router,       // Vue Router instance for returnTo navigation
  fetchProfile: true,
});
</script>

<!-- Consumer -->
<script setup>
const { user, isAuthenticated, isLoading, error, tokens, actions } = useAuth();
</script>

<!-- Guard: navigation guard registered by plugin -->
<script>
// Automatically registered by oidcPlugin:
// router.beforeEach((to) => { ... redirect to login if not authenticated ... })
// Or use per-route meta: { meta: { requiresAuth: true } }
</script>
```

### Svelte

```svelte
<!-- Provider: wraps app in +layout.svelte -->
<AuthProvider {config} onLogin={({ returnTo }) => goto(returnTo, { replaceState: true })}>
  <slot />
</AuthProvider>

<!-- Consumer -->
<script>
  const { user, isAuthenticated, isLoading, error, tokens, actions } = getAuthContext();
</script>

<!-- Guard -->
<RequireAuth fallback={Loading}>
  <ProtectedContent />
</RequireAuth>
```

### Angular

```typescript
// Provider: configured in app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth({
      config: { issuer, clientId, redirectUri, scopes },
      fetchProfile: true,
    }),
    provideRouter(routes),
  ],
};

// Consumer: inject service in components
@Component({ ... })
export class DashboardComponent {
  private auth = inject(AuthService);
  user = this.auth.user;                   // Signal<AuthUser | null>
  isAuthenticated = this.auth.isAuthenticated; // Signal<boolean>
}

// Guard: functional route guard
export const routes: Routes = [
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
];
```

### Solid

```tsx
// Provider
<AuthProvider config={config} onLogin={({ returnTo }) => navigate(returnTo, { replace: true })}>
  <App />
</AuthProvider>

// Consumer
const auth = useAuth();
// auth.user, auth.isAuthenticated, etc. are accessors (getters backed by signals)

// Guard
<RequireAuth fallback={<Loading />}>
  <ProtectedContent />
</RequireAuth>
```

### Preact

```tsx
// Provider (same API as React, uses Preact's hooks)
<AuthProvider config={config} onLogin={({ returnTo }) => route(returnTo, true)}>
  <App />
</AuthProvider>

// Consumer
const { user, isAuthenticated, isLoading, error, tokens, actions } = useAuth();

// Guard
<RequireAuth fallback={<Loading />}>
  <ProtectedContent />
</RequireAuth>
```

Preact's adapter is nearly identical to React. The key differences are:
- Imports from `preact/hooks` instead of `react`
- Router integration uses `preact-router` or `wouter` instead of `react-router`
- Package peer-depends on `preact >= 10.0.0`

### Lit

```typescript
// Controller: instantiated in component constructor
@customElement('my-dashboard')
export class Dashboard extends LitElement {
  private auth = new AuthController(this, {
    config: { issuer, clientId, redirectUri, scopes },
    fetchProfile: true,
    onLogin: ({ returnTo }) => Router.go(returnTo),
  });

  render() {
    if (this.auth.isLoading) return html`<loading-spinner></loading-spinner>`;
    if (!this.auth.isAuthenticated) return html`<button @click=${() => this.auth.login()}>Login</button>`;
    return html`<p>Welcome ${this.auth.user?.claims.sub}</p>`;
  }
}

// Guard: custom element that wraps protected content
html`
  <require-auth .auth=${this.auth} .fallback=${html`<loading-spinner></loading-spinner>`}>
    <protected-content></protected-content>
  </require-auth>
`;
```

Lit uses `ReactiveController` instead of context/hooks. The controller:
- Implements `ReactiveController` interface (`hostConnected`, `hostDisconnected`)
- Calls `this.host.requestUpdate()` when auth state changes
- Is instantiated per-component (not shared via context)
- For shared state across components, use a singleton `OidcClient` passed to the controller

### Ember

```typescript
// Service: registered automatically via Ember's DI
// app/services/oidc.ts
export default class OidcService extends Service {
  @tracked user: AuthUser | null = null;
  @tracked isAuthenticated = false;
  @tracked isLoading = true;
  @tracked error: Error | null = null;

  login(options?: LoginOptions): void { ... }
  logout(): void { ... }
  refresh(): Promise<void> { ... }
}

// Consumer: inject in routes/components
export default class DashboardRoute extends Route {
  @service declare oidc: OidcService;

  beforeModel(transition) {
    if (!this.oidc.isAuthenticated) {
      this.oidc.login({ returnTo: transition.intent.url });
    }
  }
}

// Component consumer
export default class ProfileComponent extends Component {
  @service declare oidc: OidcService;
  // Access this.oidc.user, this.oidc.isAuthenticated, etc.
}

// Guard: use beforeModel hook in routes (Ember convention)
// Or create an authenticated route mixin/decorator
```

Ember uses its built-in service/DI system:
- Auth state lives in a singleton `OidcService`
- Components and routes inject it with `@service`
- Route protection uses Ember's `beforeModel` hook (not a separate guard component)
- Reactivity uses `@tracked` properties
- Package peer-depends on `ember-source >= 4.0.0`

## Checklist

- [ ] `packages/<framework>/` scaffolded with package.json, tsconfig.json, tsconfig.typedoc.json, vite.config
- [ ] Adapter implements provider, auth accessor, and auth guard
- [ ] All exports have TSDoc comments
- [ ] `pnpm --filter oidc-js-<framework> build` succeeds
- [ ] `pnpm --filter oidc-js-<framework> lint` passes
- [ ] `tests/e2e/<framework>-app/` renders all required data-testid attributes
- [ ] `tests/e2e/<framework>-app/` supports fetchProfile toggle via localStorage
- [ ] `tests/e2e/<framework>-app/` uses framework router with onLogin replace navigation
- [ ] Playwright config created and test script added
- [ ] All E2E specs pass: `pnpm --filter e2e-tests test:<framework>`
- [ ] CI updated to run the new E2E tests
- [ ] Docs sidebar and guide pages added
- [ ] TypeDoc plugin instance configured for the adapter
- [ ] decisions.md updated with any design decisions
