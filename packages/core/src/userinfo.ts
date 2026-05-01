import type { OidcDiscovery, HttpRequest, OidcUser } from "./types.js";
import { OidcError } from "./errors.js";

/**
 * Builds an HTTP request to the UserInfo endpoint using a Bearer access token.
 *
 * @param discovery - The OIDC discovery document containing the `userinfo_endpoint`.
 * @param accessToken - A valid access token issued by the authorization server.
 * @returns An {@link HttpRequest} configured with the Bearer Authorization header.
 *
 * @see OpenID Connect Core 1.0 §5.3.1 -- UserInfo Request
 * @see RFC 6750 §2.1 -- Bearer token in Authorization header
 */
// OIDC Core §5.3.1: UserInfo Request
// RFC 6750 §2.1: Bearer token in Authorization header
export function buildUserinfoRequest(discovery: OidcDiscovery, accessToken: string): HttpRequest {
  return {
    url: discovery.userinfo_endpoint,
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
}

/**
 * Parses and validates a UserInfo response, ensuring the required `sub` claim is present.
 *
 * @param data - The parsed JSON body returned from the UserInfo endpoint.
 * @returns The validated {@link OidcUser} object.
 * @throws {@link OidcError} with code `TOKEN_EXCHANGE_ERROR` if the response is not an object or `sub` is missing.
 *
 * @see OpenID Connect Core 1.0 §5.3.2 -- UserInfo Response
 */
// OIDC Core §5.3.2: UserInfo Response
export function parseUserinfoResponse(data: unknown): OidcUser {
  if (!data || typeof data !== "object") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "UserInfo response must be a JSON object");
  }

  const response = data as Record<string, unknown>;

  // OIDC Core §5.3.2: sub claim is REQUIRED
  if (typeof response.sub !== "string") {
    throw new OidcError("TOKEN_EXCHANGE_ERROR", "Missing or invalid 'sub' claim in UserInfo response");
  }

  return data as OidcUser;
}
