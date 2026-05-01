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

/** Callback invoked whenever the {@link AuthState} changes. */
type Subscriber = (state: AuthState) => void;

const EMPTY_TOKENS: AuthTokens = { access: null, id: null, refresh: null, expiresAt: null };

/**
 * Extracts the `exp` claim from an access token JWT and converts it to milliseconds.
 *
 * @param accessToken - A JWT access token string.
 * @returns The expiration time in milliseconds, or null if the token cannot be decoded.
 */
function extractExpiresAt(accessToken: string): number | null {
  try {
    const payload = decodeJwtPayload(accessToken);
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch { /* malformed JWT */ }
  return null;
}

/**
 * Browser OIDC client that wraps oidc-js-core with `fetch` and `sessionStorage`.
 *
 * Handles the full Authorization Code + PKCE flow: discovery, redirect-based login,
 * callback handling, token refresh, userinfo fetching, and logout.
 * Exposes reactive {@link AuthState} via a subscribe/notify pattern.
 */
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

  /**
   * Creates a new OidcClient instance.
   *
   * @param config - OIDC configuration including issuer, clientId, and redirectUri.
   */
  constructor(config: OidcClientConfig) {
    this.config = config;
  }

  /** The current authentication state. */
  get state(): AuthState {
    return this._state;
  }

  /**
   * Registers a callback that fires whenever the auth state changes.
   *
   * @param fn - Subscriber function receiving the updated {@link AuthState}.
   * @returns An unsubscribe function that removes the listener.
   */
  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Merges a partial state update into the current state and notifies all subscribers.
   */
  private setState(partial: Partial<AuthState>) {
    this._state = { ...this._state, ...partial };
    for (const fn of this.subscribers) {
      fn(this._state);
    }
  }

  /**
   * Initializes the client by fetching OIDC discovery and processing any callback parameters.
   *
   * If the current URL contains an authorization code, it completes the token exchange,
   * optionally fetches the userinfo profile, and returns the `returnTo` path saved before login.
   * If the URL contains an error, it sets the error state.
   *
   * @returns An object with an optional `returnTo` path indicating where the app should navigate.
   */
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

  /**
   * Starts the Authorization Code + PKCE login flow by redirecting the browser to the authorization endpoint.
   *
   * Generates PKCE, state, and nonce values, persists them in sessionStorage, then navigates away.
   * Does nothing if discovery has not been fetched yet (i.e., {@link init} was not called).
   *
   * @param options - Optional login parameters such as `returnTo` and `extraParams`.
   */
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

  /**
   * Logs the user out by clearing local auth state and redirecting to the OP's end-session endpoint.
   *
   * If the discovery document has an `end_session_endpoint`, the browser is redirected there
   * with the current ID token hint and `postLogoutRedirectUri` from config.
   */
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

  /**
   * Uses the stored refresh token to obtain a new set of tokens from the token endpoint.
   *
   * Updates the auth state with the new tokens and, if an ID token is returned,
   * re-decodes the claims and optionally re-fetches the userinfo profile.
   *
   * @throws Error if no refresh token is available or discovery has not been fetched.
   */
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

  /**
   * Fetches the user's profile from the userinfo endpoint using the current access token.
   *
   * Updates the `user.profile` field in the auth state with the response.
   *
   * @throws Error if no access token is available or discovery has not been fetched.
   */
  async fetchProfile(): Promise<void> {
    if (!this.discovery || !this._state.tokens.access) {
      throw new Error("No access token available");
    }

    const profile = await this.fetchProfileInternal(this._state.tokens.access);
    if (this._state.user) {
      this.setState({ user: { ...this._state.user, profile } });
    }
  }

  /**
   * Tears down the client by aborting any in-flight requests and removing all subscribers.
   */
  destroy(): void {
    this.abortController?.abort();
    this.subscribers.clear();
  }

  /**
   * Internal helper that calls the userinfo endpoint and parses the response.
   *
   * @param accessToken - Bearer token to authorize the request.
   * @param signal - Optional abort signal for cancellation.
   * @returns The parsed userinfo response.
   */
  private async fetchProfileInternal(accessToken: string, signal?: AbortSignal): Promise<OidcUser> {
    const req = buildUserinfoRequest(this.discovery!, accessToken);
    const data = await executeFetch(req, signal);
    return parseUserinfoResponse(data);
  }
}
