export { OidcError, type OidcErrorCode } from "./errors.js";

export {
  generateRandom,
  computeCodeChallenge,
  generatePkce,
  generateState,
  generateNonce,
  base64UrlEncode,
  base64UrlDecode,
} from "./crypto.js";

export { buildDiscoveryUrl, parseDiscoveryResponse } from "./discovery.js";
export { buildAuthUrl, parseCallbackUrl } from "./authorize.js";
export { buildTokenRequest, buildRefreshRequest, parseTokenResponse } from "./token.js";
export { buildUserinfoRequest, parseUserinfoResponse } from "./userinfo.js";
export { buildIntrospectRequest, parseIntrospectResponse } from "./introspect.js";
export { buildRevocationRequest } from "./revocation.js";
export { buildLogoutUrl } from "./logout.js";
export { decodeJwtPayload, parseIdTokenClaims } from "./jwt.js";
export { computeExpiresAt, isTokenExpired, timeUntilExpiry } from "./token-utils.js";
export { buildClientAuthHeaders } from "./auth.js";

export type {
  OidcConfig,
  OidcDiscovery,
  TokenResponse,
  TokenSet,
  AuthState,
  OidcUser,
  HttpRequest,
  IntrospectionResponse,
} from "./types.js";
