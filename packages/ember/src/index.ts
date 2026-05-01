export { OidcService, createOidcService } from "./services/oidc.js";
export type { OidcServiceConfig } from "./services/oidc.js";

export { authenticatedRoute } from "./helpers/require-auth.js";
export type { AuthenticatedRouteOptions } from "./helpers/require-auth.js";

export type {
  IdTokenClaims,
  AuthUser,
  AuthTokens,
  AuthActions,
  EmberOidcConfig,
  LoginOptions,
} from "./types.js";

export type { OidcConfig, OidcUser, TokenSet } from "oidc-js-core";
