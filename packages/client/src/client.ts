import {
  buildDiscoveryUrl,
  parseDiscoveryResponse,
  generatePkce,
  generateState,
  generateNonce,
  buildAuthUrl,
  parseCallbackUrl,
  buildTokenRequest,
  buildRefreshRequest,
  parseTokenResponse,
  buildUserinfoRequest,
  parseUserinfoResponse,
  buildLogoutUrl,
  decodeJwtPayload,
  type OidcDiscovery,
  type OidcUser,
} from "oidc-js-core";
import { executeFetch } from "./fetch.js";
import { saveAuthState, loadAuthState, clearAuthState } from "./storage.js";
import type { OidcClientConfig, AuthState, AuthUser, AuthTokens, IdTokenClaims, LoginOptions } from "./types.js";

type Subscriber = (state: AuthState) => void;

const EMPTY_TOKENS: AuthTokens = { access: null, id: null, refresh: null, expiresAt: null };

function extractExpiresAt(accessToken: string): number | null {
  try {
    const payload = decodeJwtPayload(accessToken);
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch { /* malformed JWT */ }
  return null;
}

export class OidcClient {
  private config: OidcClientConfig;
  private discovery: OidcDiscovery | null = null;
  private subscribers = new Set<Subscriber>();
  private abortController: AbortController | null = null;

  private _state: AuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    tokens: EMPTY_TOKENS,
  };

  constructor(config: OidcClientConfig) {
    this.config = config;
  }

  get state(): AuthState {
    return this._state;
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  private setState(partial: Partial<AuthState>) {
    this._state = { ...this._state, ...partial };
    for (const fn of this.subscribers) {
      fn(this._state);
    }
  }

  async init(): Promise<{ returnTo?: string }> {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      const url = buildDiscoveryUrl(this.config.issuer);
      const data = await executeFetch({ url, method: "GET", headers: {} }, signal);
      this.discovery = parseDiscoveryResponse(data, this.config.issuer);

      const params = new URLSearchParams(window.location.search);

      if (params.has("error")) {
        const description = params.get("error_description") ?? params.get("error")!;
        const err = new Error(description);
        this.setState({ error: err, isLoading: false });
        clearAuthState();
        window.history.replaceState({}, "", window.location.pathname);
        return {};
      }

      if (params.has("code") && params.has("state")) {
        const authState = loadAuthState();
        if (!authState) {
          this.setState({ error: new Error("Missing auth state in session storage"), isLoading: false });
          return {};
        }

        const { code } = parseCallbackUrl(window.location.href, authState.state);
        const tokenReq = buildTokenRequest(this.discovery, this.config, code, authState.codeVerifier);
        const tokenData = await executeFetch(tokenReq, signal);
        const tokenSet = parseTokenResponse(tokenData, authState.nonce);

        const newTokens: AuthTokens = {
          access: tokenSet.access_token,
          id: tokenSet.id_token ?? null,
          refresh: tokenSet.refresh_token ?? null,
          expiresAt: extractExpiresAt(tokenSet.access_token),
        };

        let user: AuthUser | null = null;
        if (tokenSet.id_token) {
          const claims = decodeJwtPayload(tokenSet.id_token) as IdTokenClaims;
          let profile: OidcUser | null = null;
          if (this.config.fetchProfile !== false) {
            profile = await this.fetchProfileInternal(tokenSet.access_token, signal);
          }
          user = { claims, profile };
        }

        const returnTo = authState.returnTo ?? "/";
        clearAuthState();

        this.setState({
          tokens: newTokens,
          user,
          isAuthenticated: true,
          isLoading: false,
        });

        return { returnTo };
      }

      this.setState({ isLoading: false });
      return {};
    } catch (e) {
      if ((e as Error).name === "AbortError") return {};
      const err = e instanceof Error ? e : new Error(String(e));
      this.setState({ error: err, isLoading: false });
      return {};
    }
  }

  async login(options?: LoginOptions): Promise<void> {
    if (!this.discovery) return;

    const pkce = await generatePkce();
    const state = generateState();
    const nonce = generateNonce();

    const returnTo = options?.returnTo
      ?? window.location.pathname + window.location.search + window.location.hash;

    saveAuthState({
      codeVerifier: pkce.verifier,
      state,
      nonce,
      redirectUri: this.config.redirectUri ?? "",
      returnTo,
    });

    const url = buildAuthUrl(this.discovery, this.config, pkce, state, nonce, options?.extraParams);
    window.location.href = url;
  }

  logout(): void {
    const idToken = this._state.tokens.id;

    this.setState({
      user: null,
      tokens: EMPTY_TOKENS,
      isAuthenticated: false,
      error: null,
    });

    if (this.discovery) {
      const logoutUrl = buildLogoutUrl(
        this.discovery,
        idToken ?? undefined,
        this.config.postLogoutRedirectUri,
      );
      if (logoutUrl) {
        window.location.href = logoutUrl;
      }
    }
  }

  async refresh(): Promise<void> {
    const refreshToken = this._state.tokens.refresh;

    if (!this.discovery || !refreshToken) {
      throw new Error("No refresh token available");
    }

    const req = buildRefreshRequest(this.discovery, this.config, refreshToken);
    const data = await executeFetch(req);
    const tokenSet = parseTokenResponse(data);

    const newTokens: AuthTokens = {
      access: tokenSet.access_token,
      id: tokenSet.id_token ?? null,
      refresh: tokenSet.refresh_token ?? null,
      expiresAt: extractExpiresAt(tokenSet.access_token),
    };

    let user = this._state.user;
    if (tokenSet.id_token) {
      const claims = decodeJwtPayload(tokenSet.id_token) as IdTokenClaims;
      let profile: OidcUser | null = user?.profile ?? null;
      if (this.config.fetchProfile !== false) {
        profile = await this.fetchProfileInternal(tokenSet.access_token);
      }
      user = { claims, profile };
    }

    this.setState({
      tokens: newTokens,
      user,
      isAuthenticated: true,
      error: null,
    });
  }

  async fetchProfile(): Promise<void> {
    if (!this.discovery || !this._state.tokens.access) {
      throw new Error("No access token available");
    }

    const profile = await this.fetchProfileInternal(this._state.tokens.access);
    if (this._state.user) {
      this.setState({ user: { ...this._state.user, profile } });
    }
  }

  destroy(): void {
    this.abortController?.abort();
    this.subscribers.clear();
  }

  private async fetchProfileInternal(accessToken: string, signal?: AbortSignal): Promise<OidcUser> {
    const req = buildUserinfoRequest(this.discovery!, accessToken);
    const data = await executeFetch(req, signal);
    return parseUserinfoResponse(data);
  }
}
