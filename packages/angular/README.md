# oidc-js-angular

Simple OIDC authentication for Angular. Drop-in signals, DI, and route guards with zero dependencies.

Part of the [oidc-js](https://github.com/eugenioenko/oidc-js) family -- OpenID Connect for every JavaScript framework.

## Install

```bash
npm install oidc-js-angular
```

`@angular/core` (>=17) and `@angular/router` (>=17) are peer dependencies.

## Quick start

Register the provider in your application config:

```typescript
// app.config.ts
import { ApplicationConfig } from "@angular/core";
import { provideRouter } from "@angular/router";
import { provideAuth } from "oidc-js-angular";
import { routes } from "./app.routes";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAuth({
      config: {
        issuer: "https://auth.example.com",
        clientId: "my-app",
        redirectUri: "http://localhost:4200/callback",
        scopes: ["openid", "profile", "email"],
      },
    }),
  ],
};
```

Inject `AuthService` in any component:

```typescript
import { Component, inject } from "@angular/core";
import { AuthService } from "oidc-js-angular";

@Component({
  selector: "app-root",
  template: `
    @if (auth.isLoading()) {
      <p>Loading...</p>
    } @else if (auth.isAuthenticated()) {
      <p>Welcome, {{ auth.user()?.profile?.name }}</p>
      <button (click)="auth.logout()">Log out</button>
    } @else {
      <button (click)="auth.login()">Log in</button>
    }
  `,
})
export class AppComponent {
  auth = inject(AuthService);
}
```

## Route guard

Protect routes with `authGuard`. It waits for initialization, auto-refreshes expired tokens when a refresh token is available, and redirects to login if the user is not authenticated.

```typescript
// app.routes.ts
import { Routes } from "@angular/router";
import { authGuard } from "oidc-js-angular";

export const routes: Routes = [
  { path: "dashboard", component: DashboardComponent, canActivate: [authGuard] },
  { path: "settings", component: SettingsComponent, canActivate: [authGuard] },
];
```

## Template usage

All state properties on `AuthService` are Angular signals. Read them in templates with the function call syntax:

```html
@if (auth.isAuthenticated()) {
  <p>Logged in as {{ auth.user()?.claims?.sub }}</p>
  <p>Access token expires at {{ auth.tokens()?.expiresAt }}</p>
}

@if (auth.error()) {
  <p>Error: {{ auth.error()?.message }}</p>
}
```

## API reference

### provideAuth(options)

Provider function that registers `AuthService`, its configuration, and an `APP_INITIALIZER` that runs during application bootstrap. Returns `EnvironmentProviders` to pass to `bootstrapApplication` or application config.

#### AuthProviderOptions

| Property | Type | Default | Description |
|---|---|---|---|
| `config` | `OidcConfig` | required | OIDC client configuration (issuer, clientId, redirectUri, scopes, etc.) |
| `fetchProfile` | `boolean` | `true` | Fetch the userinfo endpoint after login to populate `user.profile` |
| `onLogin` | `(returnTo: string) => void` | `undefined` | Called after a successful login callback with the return path. If omitted, the adapter uses `Router.navigateByUrl` to navigate. |
| `onError` | `(error: Error) => void` | `undefined` | Called when an authentication error occurs during initialization |

### AuthService

Injectable service that wraps `OidcClient` and exposes reactive state via Angular signals.

#### Signals (readonly)

| Signal | Type | Description |
|---|---|---|
| `user` | `Signal<AuthUser \| null>` | The authenticated user, or `null` if not logged in |
| `isAuthenticated` | `Signal<boolean>` | Whether the user is currently authenticated |
| `isLoading` | `Signal<boolean>` | Whether initialization or a token exchange is in progress |
| `error` | `Signal<Error \| null>` | The most recent authentication error, or `null` |
| `tokens` | `Signal<AuthTokens>` | Current set of OAuth 2.0 tokens |

#### Methods

| Method | Signature | Description |
|---|---|---|
| `login` | `(options?: LoginOptions) => Promise<void>` | Starts the Authorization Code + PKCE login flow |
| `logout` | `() => void` | Clears local state and redirects to the end-session endpoint |
| `refresh` | `() => Promise<void>` | Uses the refresh token to obtain new tokens |
| `fetchProfile` | `() => Promise<void>` | Fetches the user profile from the userinfo endpoint |

#### AuthUser

```typescript
interface AuthUser {
  claims: IdTokenClaims;
  profile: OidcUser | null;
}
```

`claims` are decoded from the ID token. `profile` is populated from the userinfo endpoint when `fetchProfile` is enabled.

#### AuthTokens

```typescript
interface AuthTokens {
  access: string | null;
  id: string | null;
  refresh: string | null;
  expiresAt: number | null;
}
```

### authGuard

A `CanActivateFn` route guard that protects routes behind authentication.

Behavior:
- Waits for the auth service to finish initializing.
- Allows navigation if the user is authenticated and the token is not expired.
- Attempts a silent token refresh if the token is expired and a refresh token exists.
- Redirects to login with the current URL as `returnTo` if the user is not authenticated or refresh fails.

### AUTH_OPTIONS

`InjectionToken<AuthProviderOptions>` provided automatically by `provideAuth`. Not intended for direct use.

## Documentation

Full documentation: [https://eugenioenko.github.io/oidc-js/angular/provide-auth/](https://eugenioenko.github.io/oidc-js/angular/provide-auth/)

## Repository

[https://github.com/eugenioenko/oidc-js](https://github.com/eugenioenko/oidc-js)

## License

MIT
