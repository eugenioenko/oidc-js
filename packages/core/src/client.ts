import type {
  OidcConfig,
  OidcDiscovery,
  TokenResponse,
  AuthState,
  OidcUser,
  Storage,
} from "./types.js";
import { generateRandom, computeCodeChallenge, decodeJwtPayload } from "./crypto.js";
import { fetchDiscovery } from "./discovery.js";
import { MemoryStorage } from "./storage.js";

const STORAGE_PREFIX = "oidc_";
const AUTH_STATE_KEY = `${STORAGE_PREFIX}auth_state`;
const TOKENS_KEY = `${STORAGE_PREFIX}tokens`;

export class OidcClient {
  private config: OidcConfig;
  private storage: Storage;
  private discovery: OidcDiscovery | null = null;

  constructor(config: OidcConfig) {
    this.config = config;
    this.storage = config.storage ?? new MemoryStorage();
  }

  async getDiscovery(): Promise<OidcDiscovery> {
    if (!this.discovery) {
      this.discovery = await fetchDiscovery(this.config.issuer);
    }
    return this.discovery;
  }

  async buildAuthUrl(extraParams?: Record<string, string>): Promise<string> {
    const discovery = await this.getDiscovery();
    const state = generateRandom();
    const nonce = generateRandom();
    const codeVerifier = generateRandom(32);
    const codeChallenge = await computeCodeChallenge(codeVerifier);

    const authState: AuthState = {
      codeVerifier,
      state,
      nonce,
      redirectUri: this.config.redirectUri,
    };
    this.storage.set(AUTH_STATE_KEY, JSON.stringify(authState));

    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: (this.config.scopes ?? ["openid", "profile", "email"]).join(" "),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      ...extraParams,
    });

    return `${discovery.authorization_endpoint}?${params.toString()}`;
  }

  async handleCallback(callbackUrl: string): Promise<TokenResponse> {
    const url = new URL(callbackUrl);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      const description = url.searchParams.get("error_description") ?? error;
      throw new Error(`Authorization error: ${description}`);
    }

    if (!code) {
      throw new Error("Missing authorization code");
    }

    const stored = this.storage.get(AUTH_STATE_KEY);
    if (!stored) {
      throw new Error("No pending auth state found");
    }

    const authState: AuthState = JSON.parse(stored);
    this.storage.remove(AUTH_STATE_KEY);

    if (returnedState !== authState.state) {
      throw new Error("State mismatch — possible CSRF attack");
    }

    const discovery = await this.getDiscovery();

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: authState.redirectUri,
      client_id: this.config.clientId,
      code_verifier: authState.codeVerifier,
    });

    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const tokens = (await response.json()) as TokenResponse;

    if (tokens.id_token) {
      const claims = decodeJwtPayload(tokens.id_token);
      if (claims.nonce !== authState.nonce) {
        throw new Error("Nonce mismatch in ID token");
      }
    }

    this.storage.set(TOKENS_KEY, JSON.stringify(tokens));
    return tokens;
  }

  async refreshToken(): Promise<TokenResponse> {
    const tokens = this.getTokens();
    if (!tokens?.refresh_token) {
      throw new Error("No refresh token available");
    }

    const discovery = await this.getDiscovery();

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
      client_id: this.config.clientId,
    });

    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Token refresh failed: ${err}`);
    }

    const newTokens = (await response.json()) as TokenResponse;
    this.storage.set(TOKENS_KEY, JSON.stringify(newTokens));
    return newTokens;
  }

  async buildLogoutUrl(): Promise<string | null> {
    const discovery = await this.getDiscovery();
    if (!discovery.end_session_endpoint) {
      return null;
    }

    const tokens = this.getTokens();
    const params = new URLSearchParams();

    if (tokens?.id_token) {
      params.set("id_token_hint", tokens.id_token);
    }
    if (this.config.postLogoutRedirectUri) {
      params.set("post_logout_redirect_uri", this.config.postLogoutRedirectUri);
    }

    return `${discovery.end_session_endpoint}?${params.toString()}`;
  }

  async revokeToken(): Promise<void> {
    const tokens = this.getTokens();
    if (!tokens) return;

    const discovery = await this.getDiscovery();
    if (!discovery.revocation_endpoint) return;

    const token = tokens.refresh_token ?? tokens.access_token;
    const body = new URLSearchParams({
      token,
      client_id: this.config.clientId,
    });

    await fetch(discovery.revocation_endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  }

  getUser(): OidcUser | null {
    const tokens = this.getTokens();
    if (!tokens?.id_token) return null;

    const claims = decodeJwtPayload(tokens.id_token);
    return claims as OidcUser;
  }

  getAccessToken(): string | null {
    return this.getTokens()?.access_token ?? null;
  }

  getTokens(): TokenResponse | null {
    const stored = this.storage.get(TOKENS_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as TokenResponse;
  }

  clearTokens(): void {
    this.storage.remove(TOKENS_KEY);
    this.storage.remove(AUTH_STATE_KEY);
  }

  isAuthenticated(): boolean {
    return this.getTokens() !== null;
  }
}
