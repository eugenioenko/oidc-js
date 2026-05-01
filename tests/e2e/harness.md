# E2E Test Harness Contract

Shared Playwright specs in `specs/` test OIDC behavior, not framework rendering. Each framework test app must implement this contract so the same specs run against all adapters.

## App Structure

Each test app lives in its own directory (e.g., `react-app/`, `vue-app/`) and runs a dev server on `http://localhost:5173`.

### Routes

The app must handle these routes using the framework's router (not hash-based):

| Route | Page | Description |
|-------|------|-------------|
| `/` | Home | Main page — shows login/logout UI and user info |
| `/callback` | Callback | OIDC callback landing — shows a loading indicator while the auth library processes the code exchange |
| `/protected-a` | Protected A | Wrapped in auth guard, shows protected content |
| `/protected-b` | Protected B | Wrapped in auth guard, shows protected content |

The `/callback` route is where the IdP redirects back with `?code=` and `?state=` query params. The auth library processes them on mount, then navigates to the `returnTo` path. The callback page only needs to show a loading indicator (`data-testid="auth-loading"`) — it is never visible for more than a moment.

All routes must use the framework's client-side router. The dev server must be configured to serve `index.html` for all paths (SPA fallback) so direct navigation and page refreshes work.

### Auth Guard

`/protected-a` and `/protected-b` must be wrapped in the framework's equivalent of `RequireAuth`:
- If loading or refreshing, show a loading indicator with `data-testid="auth-loading"`
- If authenticated and token is valid, show children
- If token is expired and a refresh token exists, attempt silent refresh
- If not authenticated, redirect to login

## data-testid Contract

Every element the specs interact with is identified by `data-testid`. All test apps must render these exactly.

### Authentication State

| Selector | Element | Content | When |
|----------|---------|---------|------|
| `auth-loading` | div | Any loading text | Auth is initializing or refreshing |
| `auth-error` | div | `Error: {message}` | Auth error occurred |
| `unauthenticated` | div | Contains login button | Not authenticated |
| `authenticated` | div | Contains user info and actions | Authenticated |

### Login / Logout / Refresh

| Selector | Element | Action |
|----------|---------|--------|
| `login-button` | button | Calls `login()` with no arguments |
| `logout-button` | button | Calls `logout()` |
| `refresh-button` | button | Calls `refresh()`, catches errors silently |

### User Claims (from ID token)

Rendered inside the `authenticated` container. Each shows the raw claim value as text content.

| Selector | Value |
|----------|-------|
| `user-sub` | `user.claims.sub` |
| `user-iss` | `user.claims.iss` |
| `user-aud` | `user.claims.aud` (string, or JSON array) |
| `user-exp` | `user.claims.exp` (number) |
| `user-iat` | `user.claims.iat` (number) |

### User Profile (from userinfo endpoint)

| Selector | Value |
|----------|-------|
| `user-email` | `user.profile.email` if profile is fetched, otherwise `"no profile"` |
| `user-profile-null` | `"true"` if `user.profile === null`, `"false"` otherwise |

### Tokens

| Selector | Value |
|----------|-------|
| `access-token` | `"present"` if access token exists, `"missing"` otherwise |
| `refresh-token` | `"present"` if refresh token exists, `"missing"` otherwise |
| `id-token` | `"present"` if ID token exists, `"missing"` otherwise |
| `expires-at` | `tokens.expiresAt` value (number), or `"none"` if null |

### Navigation Links

Rendered on the home page (`authenticated` container) and on both protected pages. These must be client-side links (not `<a href>`), because tokens are held in memory and a full page reload loses them.

| Selector | Element | Target |
|----------|---------|--------|
| `link-home` | link | `/` |
| `link-protected-a` | link | `/protected-a` |
| `link-protected-b` | link | `/protected-b` |

The home page only needs `link-protected-a` and `link-protected-b`. Protected pages need all three (`link-home`, `link-protected-a`, `link-protected-b`).

### Protected Pages

| Selector | Element | Content |
|----------|---------|---------|
| `protected-a` | div | Any text (shown when auth guard passes on `/protected-a`) |
| `protected-b` | div | Any text (shown when auth guard passes on `/protected-b`) |

## OIDC Configuration

All test apps use the same OIDC config:

```
issuer:                  http://localhost:9999/oauth2
clientId:                e2e-test-app
redirectUri:             http://localhost:5173/callback
scopes:                  openid profile email offline_access
postLogoutRedirectUri:   http://localhost:5173
```

### fetchProfile toggle

The `fetchProfile` setting is toggled via `localStorage`:
- Default (no key): `fetchProfile = true` — userinfo is fetched after login
- `localStorage.setItem("e2e-fetchProfile", "false")`: `fetchProfile = false` — userinfo is skipped

Read this value at app startup (before the auth provider mounts) and pass it to the auth configuration.

## Test Coverage

The shared specs (`specs/login.spec.ts`) cover 13 tests across 4 groups:

### OIDC Login Flow (7 tests)
1. **Unauthenticated state** — shows login button, no user info
2. **Full login with tokens** — completes PKCE flow, access/refresh/id tokens present
3. **ID token claims** — sub, iss, aud, exp, iat populated correctly
4. **Profile populated** — userinfo endpoint fetched, email visible
5. **Profile null** — fetchProfile=false skips userinfo, profile is null
6. **Logout** — clears state, subsequent visit shows unauthenticated
7. **Manual refresh** — refresh button gets new tokens with different expiresAt

### Security (2 tests)
8. **Tokens not in storage** — after login, verifies localStorage and sessionStorage contain no token values. Validates the memory-only security model.
9. **Back button after logout** — after logout, browser back does not show authenticated content. Verifies state is truly cleared.

### Deep Linking (1 test)
10. **Login from protected page returns to that page** — navigates directly to `/protected-a` while unauthenticated, RequireAuth triggers login, after login lands back on `/protected-a` (not `/`). Validates the `returnTo` flow.

### RequireAuth (3 tests)
11. **Shows protected content** — authenticated user navigates to protected page via client-side link
12. **Auto-refresh on expired token** — access token set to 1s TTL, wait for expiry, navigate to second protected page, RequireAuth auto-refreshes
13. **Redirects to login on revoked refresh token** — access token set to 1s TTL, all sessions revoked server-side, wait for expiry, navigate to second protected page, refresh fails, RequireAuth redirects to login

### Admin API helpers used by tests

The specs use Autentico's admin API for test setup:
- `GET /admin/api/users` — find test user ID
- `PUT /admin/api/clients/e2e-test-app` — set per-client `access_token_expiration` for TTL tests
- `POST /admin/api/users/{id}/revoke-sessions` — revoke all user sessions/tokens for failed-refresh test

## IdP Setup

The global setup (`global-setup.ts`) handles:
1. Downloading and starting Autentico (OIDC IdP)
2. Registering the `e2e-test-app` client
3. Creating the test user (`testuser` / `TestUser123!`)
4. Configuring CORS

Test apps do not need to handle any IdP setup.

## Adding a New Framework

1. Create a directory: `tests/e2e/{framework}-app/`
2. Scaffold a minimal app with the framework's OIDC adapter
3. Implement all routes and `data-testid` selectors from this contract
4. Configure the dev server on port 5173 with SPA fallback
5. Add a `package.json` with `dev` and `build` scripts
6. Update `playwright.config.ts` to point `webServer.command` at the new app
7. Run `pnpm --filter e2e-tests test` — all specs should pass without modification
