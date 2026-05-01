# oidc-js-vue

Vue 3 adapter for [oidc-js](https://github.com/eugenioenko/oidc-js). Provides `oidcPlugin`, `useAuth` composable, `RequireAuth` component, and `createAuthGuard` for OpenID Connect authentication.

## Install

```bash
npm install oidc-js-vue
```

`vue` (>=3.3) is a peer dependency.

## Quick start

Install the plugin in your `main.ts`:

```ts
import { createApp } from "vue";
import { oidcPlugin } from "oidc-js-vue";
import App from "./App.vue";

const app = createApp(App);

app.use(oidcPlugin, {
  config: {
    issuer: "https://auth.example.com",
    clientId: "my-app",
    redirectUri: "http://localhost:3000/callback",
    scopes: ["openid", "profile", "email"],
  },
});

app.mount("#app");
```

Use the `useAuth` composable in any component:

```vue
<script setup lang="ts">
import { useAuth } from "oidc-js-vue";

const { user, isAuthenticated, isLoading, actions } = useAuth();
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isAuthenticated">
    <p>Welcome, {{ user?.profile?.name }}</p>
    <button @click="actions.logout()">Log out</button>
  </div>
  <div v-else>
    <button @click="actions.login()">Log in</button>
  </div>
</template>
```

## RequireAuth

Renderless component that guards its slot content behind authentication. Unauthenticated users are redirected to login automatically.

```vue
<script setup lang="ts">
import { RequireAuth } from "oidc-js-vue";
</script>

<template>
  <RequireAuth>
    <template #fallback>
      <p>Redirecting to login...</p>
    </template>
    <Dashboard />
  </RequireAuth>
</template>
```

`RequireAuth` will attempt a silent token refresh before redirecting. Disable this with `:autoRefresh="false"`:

```vue
<RequireAuth :autoRefresh="false">
  <Dashboard />
</RequireAuth>
```

## Router guard

Use `createAuthGuard` to protect routes with Vue Router. Call it inside a component's `<script setup>` so it has access to the plugin's injection context:

```vue
<script setup lang="ts">
import { useRouter } from "vue-router";
import { createAuthGuard } from "oidc-js-vue";

const router = useRouter();
createAuthGuard(router);
</script>
```

The guard waits for initialization to complete, attempts a token refresh when expired, and falls back to a full login redirect. The user's original destination is preserved as the `returnTo` path.

## API reference

### oidcPlugin

Vue plugin installed with `app.use(oidcPlugin, options)`. Initializes the OIDC client, subscribes to state changes, and provides reactive auth state to the component tree.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `config` | `OidcConfig` | required | OIDC client configuration (issuer, clientId, redirectUri, scopes, etc.) |
| `fetchProfile` | `boolean` | `true` | Fetch the userinfo endpoint after login to populate `user.profile` |
| `onLogin` | `(returnTo: string) => void` | `undefined` | Called after a successful login redirect. Receives the original URL the user was on. If omitted, `history.replaceState` restores the URL automatically. |
| `onError` | `(error: Error) => void` | `undefined` | Called when an authentication error occurs during initialization |

### useAuth()

Composable that returns the current authentication state and actions. Must be called inside a component tree where `oidcPlugin` is installed.

```ts
interface UseAuthReturn {
  config: OidcConfig;
  user: ComputedRef<AuthUser | null>;
  isAuthenticated: ComputedRef<boolean>;
  isLoading: ComputedRef<boolean>;
  error: ComputedRef<Error | null>;
  tokens: ComputedRef<AuthTokens>;
  actions: AuthActions;
}
```

All state properties are Vue `ComputedRef`s for reactive tracking.

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

**AuthActions**

```ts
interface AuthActions {
  login: (options?: LoginOptions) => void;
  logout: () => void;
  refresh: () => Promise<void>;
  fetchProfile: () => Promise<void>;
}
```

### RequireAuth

Renderless component that renders the default slot only when the user is authenticated with a valid token. Renders the `fallback` slot while loading or when authentication is required.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `autoRefresh` | `boolean` | `true` | Attempt a silent token refresh before redirecting to login |
| `loginOptions` | `LoginOptions` | `undefined` | Options passed to `login()` when a redirect is triggered |

**Slots**

| Slot | Description |
|------|-------------|
| `default` | Content shown to authenticated users |
| `fallback` | Rendered while loading or redirecting |

### createAuthGuard(router, options?)

Navigation guard factory. Must be called inside `<script setup>` or a component `setup()` function.

| Parameter | Type | Description |
|-----------|------|-------------|
| `router` | Vue Router instance | The router to attach the `beforeEach` guard to |
| `options` | `AuthGuardOptions` | Optional. Contains `loginOptions` passed to `login()` on redirect |

## Documentation

Full documentation: [https://eugenioenko.github.io/oidc-js/vue/plugin/](https://eugenioenko.github.io/oidc-js/vue/plugin/)

## Repository

[https://github.com/eugenioenko/oidc-js](https://github.com/eugenioenko/oidc-js)

## License

MIT
