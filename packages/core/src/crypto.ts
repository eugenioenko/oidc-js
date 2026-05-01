import { OidcError } from "./errors.js";

// RFC 7636 §4.1: unreserved characters for code_verifier
const UNRESERVED = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

// RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(ASCII(code_verifier)))
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

// RFC 7636 §4.1: code_verifier = 43-128 unreserved chars
// RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(code_verifier))
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandom(43);
  const challenge = await computeCodeChallenge(verifier);
  return { verifier, challenge };
}

// RFC 6749 §10.12: state for CSRF protection
export function generateState(): string {
  return generateRandom(32);
}

// OIDC Core §3.1.2.1: nonce binds client session to ID token
export function generateNonce(): string {
  return generateRandom(32);
}
