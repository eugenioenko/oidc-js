<script setup lang="ts">
import { RequireAuth } from "oidc-js-vue";
</script>

<template>
  <RequireAuth>
    <template #fallback>
      <div data-testid="auth-loading">Refreshing...</div>
    </template>
    <div data-testid="protected-b">Protected content b</div>
    <nav>
      <router-link data-testid="link-home" to="/">Home</router-link>
      <router-link data-testid="link-protected-a" to="/protected-a">Protected A</router-link>
      <router-link data-testid="link-protected-b" to="/protected-b">Protected B</router-link>
    </nav>
  </RequireAuth>
</template>
