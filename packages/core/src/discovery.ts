import type { OidcDiscovery } from "./types.js";

export async function fetchDiscovery(issuer: string): Promise<OidcDiscovery> {
  const url = `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Discovery request failed: ${response.status}`);
  }
  const config = (await response.json()) as OidcDiscovery;
  if (config.issuer !== issuer && config.issuer !== issuer.replace(/\/+$/, "")) {
    throw new Error(`Issuer mismatch: expected ${issuer}, got ${config.issuer}`);
  }
  return config;
}
