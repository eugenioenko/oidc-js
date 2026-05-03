import { inject } from "@angular/core";
import type { CanActivateFn } from "@angular/router";
import { isExpiredAt } from "oidc-js-core";
import { AuthService } from "./auth.service.js";

export interface AuthGuardOptions {
  /** Buffer in milliseconds before token expiry to consider it expired. Defaults to 30000. */
  tokenExpirationBuffer?: number;
}

/**
 * Creates a functional route guard that protects routes behind authentication.
 *
 * Behavior:
 * - If the auth service is still loading, waits until initialization completes.
 * - If the user is authenticated and the token is not expired, allows navigation.
 * - If the token is expired and a refresh token exists, attempts a silent refresh.
 * - If the user is not authenticated or refresh fails, redirects to login with
 *   the current URL as the `returnTo` path.
 *
 * @example
 * ```typescript
 * const routes: Routes = [
 *   { path: 'protected', component: ProtectedComponent, canActivate: [createAuthGuard()] },
 * ];
 * ```
 */
export function createAuthGuard(options?: AuthGuardOptions): CanActivateFn {
  return async (route, state) => {
    const auth = inject(AuthService);

    if (auth.isLoading()) {
      await waitForLoading(auth);
    }

    const tokens = auth.tokens();
    const isExpired = isExpiredAt(tokens.expiresAt, options?.tokenExpirationBuffer);

    if (auth.isAuthenticated() && !isExpired) {
      return true;
    }

    if (auth.isAuthenticated() && isExpired && tokens.refresh) {
      try {
        await auth.refresh();
        return true;
      } catch {
        // Refresh failed — fall through to login redirect
      }
    }

    await auth.login({ returnTo: state.url });
    return false;
  };
}

/** Pre-built auth guard using default options. Use {@link createAuthGuard} for custom configuration. */
export const authGuard: CanActivateFn = createAuthGuard();

/**
 * Returns a promise that resolves when the auth service finishes loading.
 */
function waitForLoading(auth: AuthService): Promise<void> {
  return new Promise<void>((resolve) => {
    const check = () => {
      if (!auth.isLoading()) {
        resolve();
      } else {
        setTimeout(check, 50);
      }
    };
    check();
  });
}
