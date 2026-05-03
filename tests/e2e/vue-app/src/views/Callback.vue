<script setup lang="ts">
import { useAuth } from "oidc-js-vue";

const { error } = useAuth();
</script>

<template>
  <div v-if="error" data-testid="auth-error">Error: {{ error.message }}</div>
  <div v-else data-testid="auth-loading">Processing login...</div>
</template>
