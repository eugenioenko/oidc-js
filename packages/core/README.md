# oidc-js-core

Pure-functional, zero-dependency OIDC (OpenID Connect) core library for JavaScript and TypeScript. Builds HTTP requests and parses responses -- no fetch, no storage, no side effects. Uses only the Web Crypto API for PKCE. Works in any JS runtime: browser, Node.js, Deno, Bun, Cloudflare Workers.

## Install

```bash
npm install oidc-js-core
```

## Quick start

The library follows a "functional core, imperative shell" pattern. Core functions build request descriptors and parse responses. Your application handles the actual HTTP calls and storage.

Here is a complete Authorization Code + PKCE flow:

```ts
import {
  buildDiscoveryUrl,
  parseDiscoveryResponse,
  generatePkce,
  generateState,
  generateNonce,
  buildAuthUrl,
  parseCallbackUrl,
  buildTokenRequest,
  parseTokenResponse,
} from "oidc-js-core";

const config = {
  issuer: "https://accounts.example.com",
  clientId: "my-app",
  redirectUri: "https://my-app.example.com/callback",
  scopes: ["openid", "profile", "email"],
};

// 1. Discover the provider's endpoints
const discoveryUrl = buildDiscoveryUrl(config.issuer);
const discoveryData = await fetch(discoveryUrl).then((r) => r.json());
const discovery = parseDiscoveryResponse(discoveryData, config.issuer);

// 2. Generate PKCE, state, and nonce
const pkce = await generatePkce();
const state = generateState();
const nonce = generateNonce();

// 3. Build the authorization URL and redirect the user
const authUrl = buildAuthUrl(discovery, config, pkce, state, nonce);
// Store state, nonce, and pkce.verifier before redirecting
// e.g. sessionStorage.setItem("auth_state", JSON.stringify({ state, nonce, codeVerifier: pkce.verifier }));
window.location.href = authUrl;

// --- after redirect back to your app ---

// 4. Parse the callback URL and verify state
const { code } = parseCallbackUrl(window.location.href, state);

// 5. Exchange the authorization code for tokens
const tokenRequest = buildTokenRequest(discovery, config, code, pkce.verifier);
const tokenData = await fetch(tokenRequest.url, {
  method: tokenRequest.method,
  headers: tokenRequest.headers,
  body: tokenRequest.body,
}).then((r) => r.json());

const tokenSet = parseTokenResponse(tokenData, nonce);
// tokenSet.access_token, tokenSet.id_token, tokenSet.refresh_token, tokenSet.expires_at
```

## API reference

### Discovery

| Function | Signature | Description |
|---|---|---|
| `buildDiscoveryUrl` | `(issuer: string) => string` | Builds the `/.well-known/openid-configuration` URL for an issuer. |
| `parseDiscoveryResponse` | `(data: unknown, expectedIssuer: string) => OidcDiscovery` | Validates a discovery response and checks the issuer matches. |

### PKCE and randomness

| Function | Signature | Description |
|---|---|---|
| `generatePkce` | `() => Promise<{ verifier: string; challenge: string }>` | Generates a PKCE code verifier and its S256 challenge. |
| `computeCodeChallenge` | `(verifier: string) => Promise<string>` | Computes the S256 code challenge from a verifier. |
| `generateState` | `() => string` | Generates a random state parameter for CSRF protection. |
| `generateNonce` | `() => string` | Generates a random nonce for ID token binding. |
| `generateRandom` | `(length?: number) => string` | Generates a cryptographically random string (default 32 chars). |

### Authorization

| Function | Signature | Description |
|---|---|---|
| `buildAuthUrl` | `(discovery, config, pkce, state, nonce, extraParams?) => string` | Builds the full authorization endpoint URL with PKCE, state, and nonce. |
| `parseCallbackUrl` | `(url: string, expectedState: string) => { code: string; state: string }` | Parses the authorization callback, extracts the code, and verifies state. |

### Token exchange

| Function | Signature | Description |
|---|---|---|
| `buildTokenRequest` | `(discovery, config, code, codeVerifier) => HttpRequest` | Builds an HTTP request to exchange an authorization code for tokens. |
| `buildRefreshRequest` | `(discovery, config, refreshToken) => HttpRequest` | Builds an HTTP request to refresh an access token. |
| `parseTokenResponse` | `(data: unknown, expectedNonce?: string) => TokenSet` | Validates a token response, checks the nonce, and computes `expires_at`. |

### UserInfo

| Function | Signature | Description |
|---|---|---|
| `buildUserinfoRequest` | `(discovery, accessToken) => HttpRequest` | Builds a GET request to the UserInfo endpoint with a Bearer token. |
| `parseUserinfoResponse` | `(data: unknown) => OidcUser` | Validates a UserInfo response and ensures the `sub` claim is present. |

### Introspection

| Function | Signature | Description |
|---|---|---|
| `buildIntrospectRequest` | `(discovery, config, token) => HttpRequest \| null` | Builds a token introspection request. Returns `null` if no endpoint. Requires `clientSecret`. |
| `parseIntrospectResponse` | `(data: unknown) => IntrospectionResponse` | Validates an introspection response and ensures the `active` field is present. |

### Revocation

| Function | Signature | Description |
|---|---|---|
| `buildRevocationRequest` | `(discovery, config, token, tokenTypeHint?) => HttpRequest \| null` | Builds a token revocation request. Returns `null` if no endpoint. |

### Logout

| Function | Signature | Description |
|---|---|---|
| `buildLogoutUrl` | `(discovery, idToken?, postLogoutRedirectUri?) => string \| null` | Builds an RP-Initiated Logout URL. Returns `null` if no endpoint. |

### JWT

| Function | Signature | Description |
|---|---|---|
| `decodeJwtPayload` | `(token: string) => Record<string, unknown>` | Decodes a JWT payload without verifying the signature. |
| `parseIdTokenClaims` | `(idToken: string) => OidcUser` | Extracts standard OIDC claims from an ID token. |

### Token utilities

| Function | Signature | Description |
|---|---|---|
| `computeExpiresAt` | `(expiresIn: number) => number` | Converts a relative `expires_in` (seconds) to an absolute Unix timestamp. |
| `isTokenExpired` | `(tokenSet: TokenSet, clockSkewSeconds?: number) => boolean` | Checks whether a token has expired, with optional clock skew allowance. |
| `timeUntilExpiry` | `(tokenSet: TokenSet) => number` | Returns seconds remaining until token expiry. Returns `Infinity` if no expiry is set. |

### Client authentication

| Function | Signature | Description |
|---|---|---|
| `buildClientAuthHeaders` | `(config: OidcConfig) => Record<string, string>` | Builds HTTP Basic auth headers from client credentials. Returns `{}` for public clients. |

## Error handling

All functions throw `OidcError` instead of generic `Error`. Each error has a typed `code` field you can switch on for programmatic handling.

```ts
import { OidcError } from "oidc-js-core";

try {
  const discovery = parseDiscoveryResponse(data, issuer);
} catch (err) {
  if (err instanceof OidcError) {
    switch (err.code) {
      case "DISCOVERY_INVALID":
        // missing required fields in the discovery response
        break;
      case "DISCOVERY_ISSUER_MISMATCH":
        // returned issuer does not match the expected issuer
        break;
    }
  }
}
```

### Error codes

| Code | Thrown by | Meaning |
|---|---|---|
| `DISCOVERY_INVALID` | `parseDiscoveryResponse` | Discovery response is missing required fields. |
| `DISCOVERY_ISSUER_MISMATCH` | `parseDiscoveryResponse` | Returned issuer does not match the expected issuer. |
| `STATE_MISMATCH` | `parseCallbackUrl` | Callback state does not match -- possible CSRF attack. |
| `NONCE_MISMATCH` | `parseTokenResponse` | ID token nonce does not match the expected value. |
| `MISSING_AUTH_CODE` | `parseCallbackUrl` | No authorization code in the callback URL. |
| `INVALID_JWT` | `decodeJwtPayload`, `parseIdTokenClaims` | JWT is malformed or cannot be decoded. |
| `TOKEN_EXCHANGE_ERROR` | `parseTokenResponse`, `parseUserinfoResponse`, `parseIntrospectResponse` | Token endpoint returned an invalid response. |
| `AUTHORIZATION_ERROR` | `parseCallbackUrl` | Authorization server returned an error response. |
| `MISSING_REDIRECT_URI` | `buildAuthUrl` | `redirectUri` is required but not set in config. |
| `MISSING_CLIENT_SECRET` | `buildIntrospectRequest` | `clientSecret` is required but not set in config. |

## Types

The package exports these TypeScript interfaces:

```ts
import type {
  OidcConfig,            // Client configuration (issuer, clientId, scopes, etc.)
  OidcDiscovery,         // Parsed discovery document with all provider endpoints
  TokenSet,              // Token response with computed expires_at
  AuthState,             // Pre-redirect state (codeVerifier, state, nonce, redirectUri)
  OidcUser,              // Decoded user claims from UserInfo or ID token
  HttpRequest,           // { url, method, headers, body? } -- ready for fetch()
  IntrospectionResponse, // Token introspection result with active flag
} from "oidc-js-core";
```

## Design

- **Zero dependencies** -- only uses the Web Crypto API
- **Pure functions** -- no fetch, no storage, no global state
- **Functional core, imperative shell** -- core builds requests and parses responses; your app handles IO
- **Typed errors** -- every error has a machine-readable `code` field
- **RFC-annotated** -- every validation check references the relevant RFC section
- **Universal** -- works in browsers, Node.js, Deno, Bun, and Cloudflare Workers

## License

[MIT](https://github.com/eugenioenko/oidc-js/blob/main/LICENSE)

## Links

- [GitHub repository](https://github.com/eugenioenko/oidc-js)
