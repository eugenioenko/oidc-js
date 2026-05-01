import { OidcError } from "./errors.js";

// RFC 7636 §4.1: unreserved characters for code_verifier
const UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

/**
 * Encodes a byte array to a base64url string (no padding), as defined in RFC 4648 Section 5.
 *
 * @param bytes - Raw bytes to encode.
 * @returns Base64url-encoded string without trailing `=` padding.
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes a base64url string back to a byte array.
 *
 * @param str - Base64url-encoded string (with or without padding).
 * @returns Decoded bytes.
 * @throws {@link OidcError} with code `INVALID_JWT` if the input is not valid base64url.
 */
export function base64UrlDecode(str: string): Uint8Array {
  try {
    const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new OidcError("INVALID_JWT", "Invalid base64url input");
  }
}

/**
 * Generates a cryptographically random string from the RFC 7636 unreserved character set.
 *
 * Uses rejection sampling to avoid modulo bias when mapping random bytes to the 66-character alphabet.
 *
 * @param length - Desired string length (default 32). RFC 7636 Section 4.1 requires at least 43 characters for code verifiers.
 * @returns A random string of the specified length.
 */
// RFC 7636 §4.1: code_verifier has minimum 256 bits of entropy
// Rejection sampling avoids modulo bias (256 % 66 != 0)
export function generateRandom(length: number = 32): string {
  const alphabetSize = UNRESERVED.length;
  const limit = 256 - (256 % alphabetSize);
  let result = "";
  while (result.length < length) {
    const bytes = new Uint8Array(length - result.length);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && result.length < length) {
        result += UNRESERVED[byte % alphabetSize];
      }
    }
  }
  return result;
}

/**
 * Computes a PKCE code challenge from a code verifier (RFC 7636 Section 4.2).
 *
 * Applies `BASE64URL(SHA-256(ASCII(code_verifier)))` using the Web Crypto API.
 *
 * @param verifier - The plaintext code verifier string.
 * @returns The base64url-encoded SHA-256 challenge.
 */
// RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generates a PKCE code verifier and its corresponding S256 challenge (RFC 7636 Section 4).
 *
 * @returns An object with `verifier` (43-char random string) and `challenge` (base64url SHA-256 hash).
 */
// RFC 7636 §4.1: code_verifier = 43-128 unreserved chars
// RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(code_verifier))
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandom(43);
  const challenge = await computeCodeChallenge(verifier);
  return { verifier, challenge };
}

/**
 * Generates a random `state` parameter for CSRF protection (RFC 6749 Section 10.12).
 *
 * @returns A 32-character random string.
 */
// RFC 6749 §10.12: state for CSRF protection
export function generateState(): string {
  return generateRandom(32);
}

/**
 * Generates a random `nonce` to bind an ID token to a client session
 * (OpenID Connect Core 1.0 Section 3.1.2.1).
 *
 * @returns A 32-character random string.
 */
// OIDC Core §3.1.2.1: nonce binds client session to ID token
export function generateNonce(): string {
  return generateRandom(32);
}
