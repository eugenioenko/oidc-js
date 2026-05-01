import {
  makeEnvironmentProviders,
  type EnvironmentProviders,
  APP_INITIALIZER,
} from "@angular/core";
import { AuthService, AUTH_OPTIONS } from "./auth.service.js";
import type { AuthProviderOptions } from "./types.js";

/**
 * Provides OIDC authentication services to the Angular application.
 *
 * Returns an `EnvironmentProviders` object that registers the {@link AuthService},
 * its configuration, and an `APP_INITIALIZER` that calls {@link AuthService.init}
 * during application bootstrap.
 *
 * @param options - OIDC configuration and optional callbacks.
 * @returns Environment providers to pass to `bootstrapApplication` or `provideRouter`.
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, {
 *   providers: [
 *     provideAuth({
 *       config: {
 *         issuer: 'https://accounts.example.com',
 *         clientId: 'my-app',
 *         redirectUri: 'http://localhost:4200/callback',
 *         scopes: ['openid', 'profile', 'email'],
 *       },
 *     }),
 *   ],
 * });
 * ```
 */
export function provideAuth(options: AuthProviderOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: AUTH_OPTIONS, useValue: options },
    AuthService,
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => authService.init(),
      deps: [AuthService],
      multi: true,
    },
  ]);
}
