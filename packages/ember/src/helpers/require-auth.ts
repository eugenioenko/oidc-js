import type { OidcService } from "../services/oidc.js";
import type { LoginOptions } from "oidc-js";

/**
 * Options for the `authenticatedRoute` helper.
 */
export interface AuthenticatedRouteOptions {
  /** Whether to automatically refresh expired tokens before redirecting to login. Defaults to true. */
  autoRefresh?: boolean;
  /** Additional login options passed to the login redirect. */
  loginOptions?: LoginOptions;
}

/**
 * Route protection helper for Ember routes.
 *
 * Call this function in a route's `beforeModel` hook to enforce authentication.
 * If the user is not authenticated, the helper attempts to refresh the token
 * (when `autoRefresh` is true and a refresh token exists). If refresh fails
 * or no refresh token is available, the user is redirected to the IdP login page.
 *
 * The current URL is preserved as the `returnTo` destination so the user returns
 * to the protected page after login.
 *
 * @param service - The OIDC service instance.
 * @param transition - The Ember route transition object, used to extract the target URL.
 * @param options - Options controlling auto-refresh behavior and login parameters.
 *
 * @example
 * ```typescript
 * // app/routes/dashboard.ts
 * import Route from '@ember/routing/route';
 * import { service } from '@ember/service';
 * import { authenticatedRoute } from 'oidc-js-ember';
 *
 * export default class DashboardRoute extends Route {
 *   @service declare oidc: OidcService;
 *
 *   async beforeModel(transition) {
 *     await authenticatedRoute(this.oidc, transition);
 *   }
 * }
 * ```
 */
export async function authenticatedRoute(
  service: OidcService,
  transition: { intent?: { url?: string } },
  options: AuthenticatedRouteOptions = {},
): Promise<void> {
  const { autoRefresh = true, loginOptions } = options;

  if (service.isLoading) {
    // Wait for initialization to complete
    return;
  }

  if (service.isAuthenticated) {
    // Check if token is expired
    const isExpired =
      service.tokens.expiresAt !== null &&
      service.tokens.expiresAt <= Date.now();

    if (!isExpired) {
      return;
    }

    // Token expired, try refresh
    if (autoRefresh && service.tokens.refresh) {
      try {
        await service.refresh();
        return;
      } catch {
        // Refresh failed, fall through to login
      }
    }
  }

  // Not authenticated or refresh failed, redirect to login
  const returnTo = transition.intent?.url ?? window.location.pathname;
  await service.login({ ...loginOptions, returnTo });
}
