import { inject } from "@angular/core";
import type { CanActivateFn } from "@angular/router";
import { AuthService } from "./auth.service.js";

/**
 * Functional route guard that protects routes behind authentication.
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
 *   { path: 'protected', component: ProtectedComponent, canActivate: [authGuard] },
 * ];
 * ```
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthService);

  // Wait for initialization to complete
  if (auth.isLoading()) {
    await waitForLoading(auth);
  }

  const tokens = auth.tokens();
  const isExpired = tokens.expiresAt !== null && tokens.expiresAt <= Date.now();

  // Authenticated and not expired — allow
  if (auth.isAuthenticated() && !isExpired) {
    return true;
  }

  // Expired but has refresh token — attempt refresh
  if (auth.isAuthenticated() && isExpired && tokens.refresh) {
    try {
      await auth.refresh();
      return true;
    } catch {
      // Refresh failed — fall through to login redirect
    }
  }

  // Not authenticated or refresh failed — redirect to login
  await auth.login({ returnTo: state.url });
  return false;
};

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
