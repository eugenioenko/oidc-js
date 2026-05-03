import { defineComponent, ref, watch, type PropType, type VNode } from "vue";
import { useAuth } from "./composable.js";
import type { LoginOptions } from "oidc-js";
import { isExpiredAt } from "oidc-js-core";

/**
 * Renderless component that guards its slot content behind authentication.
 *
 * Renders the default slot only when the user is authenticated and the token is not expired.
 * While loading or when authentication is required, renders the `fallback` slot instead.
 *
 * If the token is expired and `autoRefresh` is enabled (default), it attempts a token refresh.
 * If the refresh fails, it redirects the user to the OIDC login flow.
 *
 * @example
 * ```vue
 * <template>
 *   <RequireAuth>
 *     <template #fallback>
 *       <div>Loading...</div>
 *     </template>
 *     <div>Protected content</div>
 *   </RequireAuth>
 * </template>
 * ```
 */
export const RequireAuth = defineComponent({
  name: "RequireAuth",
  props: {
    /** Whether to automatically attempt a token refresh when the token is expired. Defaults to true. */
    autoRefresh: {
      type: Boolean,
      default: true,
    },
    /** Options to pass to the login method when redirecting unauthenticated users. */
    loginOptions: {
      type: Object as PropType<LoginOptions>,
      default: undefined,
    },
    /** Buffer in milliseconds before token expiry to consider it expired. Defaults to 30000. */
    tokenExpirationBuffer: {
      type: Number,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const { isAuthenticated, isLoading, tokens, actions } = useAuth();
    const refreshAttempted = ref(false);

    watch(
      [isAuthenticated, isLoading, tokens],
      () => {
        const isExpired = isExpiredAt(tokens.value.expiresAt, props.tokenExpirationBuffer);
        const needsAuth = !isAuthenticated.value || isExpired;

        if (!needsAuth) {
          refreshAttempted.value = false;
          return;
        }

        if (isLoading.value) return;

        if (props.autoRefresh && !refreshAttempted.value) {
          refreshAttempted.value = true;
          actions.refresh().catch(() => actions.login(props.loginOptions));
          return;
        }

        actions.login(props.loginOptions);
      },
      { immediate: true },
    );

    return (): VNode | VNode[] | null => {
      const isExpired = isExpiredAt(tokens.value.expiresAt, props.tokenExpirationBuffer);
      const needsAuth = !isAuthenticated.value || isExpired;

      if (isLoading.value || needsAuth) {
        return slots.fallback?.() ?? null;
      }

      return slots.default?.() ?? null;
    };
  },
});
