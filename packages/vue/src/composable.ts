import { inject, computed, type ComputedRef } from "vue";
import { AUTH_CONTEXT_KEY } from "./plugin.js";
import type { AuthActions, AuthContextValue } from "./types.js";

/**
 * Return type of the {@link useAuth} composable.
 *
 * Provides computed refs for reactive auth state and an actions object
 * for triggering authentication operations.
 */
export interface UseAuthReturn {
  /** The authenticated user, or null if not logged in. */
  user: ComputedRef<AuthContextValue["user"]>;
  /** Whether the user is currently authenticated. */
  isAuthenticated: ComputedRef<boolean>;
  /** Whether initialization or a token exchange is in progress. */
  isLoading: ComputedRef<boolean>;
  /** The most recent authentication error, or null if none. */
  error: ComputedRef<Error | null>;
  /** Current set of OAuth 2.0 tokens. */
  tokens: ComputedRef<AuthContextValue["tokens"]>;
  /** Actions for login, logout, refresh, and profile fetching. */
  actions: AuthActions;
  /** The OIDC configuration used to initialize the client. */
  config: AuthContextValue["config"];
}

/**
 * Vue composable that provides access to the OIDC authentication state and actions.
 *
 * Must be called within a component tree where the {@link oidcPlugin} has been installed.
 * Returns computed refs for reactive state tracking and an actions object for
 * triggering login, logout, refresh, and profile fetching.
 *
 * @returns The authentication state as computed refs and action methods.
 * @throws Error if called outside of a component tree with the OIDC plugin installed.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAuth } from "oidc-js-vue";
 *
 * const { user, isAuthenticated, isLoading, actions } = useAuth();
 * </script>
 *
 * <template>
 *   <div v-if="isLoading">Loading...</div>
 *   <div v-else-if="isAuthenticated">
 *     <p>Welcome, {{ user?.claims.sub }}</p>
 *     <button @click="actions.logout()">Logout</button>
 *   </div>
 *   <div v-else>
 *     <button @click="actions.login()">Login</button>
 *   </div>
 * </template>
 * ```
 */
export function useAuth(): UseAuthReturn {
  const context = inject(AUTH_CONTEXT_KEY);
  if (!context) {
    throw new Error("useAuth must be used within a component tree where oidcPlugin is installed");
  }

  return {
    user: computed(() => context.user.value),
    isAuthenticated: computed(() => context.isAuthenticated.value),
    isLoading: computed(() => context.isLoading.value),
    error: computed(() => context.error.value),
    tokens: computed(() => context.tokens.value),
    actions: context.actions,
    config: context.config,
  };
}
