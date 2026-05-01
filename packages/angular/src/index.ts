export { AuthService, AUTH_OPTIONS } from "./auth.service.js";
export { provideAuth } from "./provide-auth.js";
export { authGuard } from "./auth.guard.js";

export type {
  AuthProviderOptions,
  IdTokenClaims,
  AuthUser,
  AuthTokens,
  LoginOptions,
} from "./types.js";

export type { OidcConfig, OidcUser, TokenSet } from "oidc-js-core";
