export { oidcPlugin } from "./plugin.js";
export { useAuth } from "./composable.js";
export { RequireAuth } from "./auth-required.js";
export { createAuthGuard } from "./guard.js";

export type { UseAuthReturn } from "./composable.js";
export type { AuthGuardOptions } from "./guard.js";

export type {
  IdTokenClaims,
  AuthUser,
  AuthTokens,
  AuthActions,
  AuthContextValue,
  LoginOptions,
  OidcPluginOptions,
} from "./types.js";

export type { OidcConfig, OidcUser, TokenSet } from "oidc-js-core";
