import { inject } from "vue";
import { AUTH_CONTEXT_KEY } from "./plugin.js";
import type { LoginOptions } from "oidc-js";

/**
 * Options for the {@link createAuthGuard} navigation guard.
 */
export interface AuthGuardOptions {
  /** Options to pass to the login method when redirecting unauthenticated users. */
  loginOptions?: LoginOptions;
}

/**
 * Creates a Vue Router navigation guard that protects routes requiring authentication.
 *
 * When a user navigates to a guarded route, the guard checks authentication status.
 * If the token is expired, it attempts a refresh. If refresh fails or no refresh token
 * is available, it redirects the user to the OIDC login flow, preserving the original
 * destination as the `returnTo` path.
 *
 * This function must be called inside a component's `setup()` function or `<script setup>`,
 * as it uses `inject()` to access the auth context provided by the {@link oidcPlugin}.
 *
 * @param router - The Vue Router instance to attach the guard to.
 * @param options - Optional configuration for the guard behavior.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useRouter } from "vue-router";
 * import { createAuthGuard } from "oidc-js-vue";
 *
 * const router = useRouter();
 * createAuthGuard(router);
 * </script>
 * ```
 */
export function createAuthGuard(
  router: { beforeEach: (guard: (to: { fullPath: string }, from: unknown, next: (location?: string | false) => void) => void) => void },
  options?: AuthGuardOptions,
): void {
  const context = inject(AUTH_CONTEXT_KEY);
  if (!context) {
    throw new Error("createAuthGuard must be used within a component tree where oidcPlugin is installed");
  }

  router.beforeEach(async (to, _from, next) => {
    // If still loading, wait for initialization to complete
    if (context.isLoading.value) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!context.isLoading.value) {
            resolve();
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      });
    }

    const isExpired =
      context.tokens.value.expiresAt !== null &&
      context.tokens.value.expiresAt <= Date.now();

    if (context.isAuthenticated.value && !isExpired) {
      next();
      return;
    }

    // If we have a refresh token, try refreshing
    if (context.tokens.value.refresh) {
      try {
        await context.actions.refresh();
        next();
        return;
      } catch {
        // Refresh failed, fall through to login
      }
    }

    // Redirect to login with returnTo
    await context.actions.login({
      returnTo: to.fullPath,
      ...options?.loginOptions,
    });

    next(false);
  });
}
