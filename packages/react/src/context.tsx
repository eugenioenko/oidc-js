import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
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
  type OidcConfig,
  type OidcDiscovery,
  type OidcUser,
} from "oidc-js-core";
import { executeFetch } from "./fetch.js";
import { saveAuthState, loadAuthState, clearAuthState } from "./storage.js";
import type { AuthContextValue, AuthUser, AuthTokens, IdTokenClaims, LoginOptions } from "./types.js";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  config: OidcConfig;
  fetchProfile?: boolean;
  onLogin?: (returnTo: string) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
}

const EMPTY_TOKENS: AuthTokens = { access: null, id: null, refresh: null, expiresAt: null };

function extractExpiresAt(accessToken: string): number | null {
  try {
    const payload = decodeJwtPayload(accessToken);
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch { /* malformed JWT */ }
  return null;
}

export function AuthProvider({
  config,
  fetchProfile = true,
  onLogin,
  onError,
  children,
}: AuthProviderProps) {
  const discoveryRef = useRef<OidcDiscovery | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tokens, setTokens] = useState<AuthTokens>(EMPTY_TOKENS);

  const configRef = useRef(config);
  configRef.current = config;

  const fetchProfileRef = useRef(fetchProfile);
  fetchProfileRef.current = fetchProfile;

  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const fetchUserProfile = useCallback(
    async (discovery: OidcDiscovery, accessToken: string, signal?: AbortSignal): Promise<OidcUser> => {
      const req = buildUserinfoRequest(discovery, accessToken);
      const data = await executeFetch(req, signal);
      return parseUserinfoResponse(data);
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    (async () => {
      try {
        const url = buildDiscoveryUrl(configRef.current.issuer);
        const data = await executeFetch({ url, method: "GET", headers: {} }, signal);
        const discovery = parseDiscoveryResponse(data, configRef.current.issuer);
        discoveryRef.current = discovery;

        const params = new URLSearchParams(window.location.search);
        if (params.has("error")) {
          const description = params.get("error_description") ?? params.get("error")!;
          const err = new Error(description);
          setError(err);
          onErrorRef.current?.(err);
          clearAuthState();
          window.history.replaceState({}, "", window.location.pathname);
          setIsLoading(false);
          return;
        }

        if (params.has("code") && params.has("state")) {
          const authState = loadAuthState();
          if (!authState) {
            setError(new Error("Missing auth state in session storage"));
            setIsLoading(false);
            return;
          }

          const { code } = parseCallbackUrl(window.location.href, authState.state);
          const tokenReq = buildTokenRequest(
            discovery,
            configRef.current,
            code,
            authState.codeVerifier,
          );
          const tokenData = await executeFetch(tokenReq, signal);
          const tokenSet = parseTokenResponse(tokenData, authState.nonce);

          const newTokens: AuthTokens = {
            access: tokenSet.access_token,
            id: tokenSet.id_token ?? null,
            refresh: tokenSet.refresh_token ?? null,
            expiresAt: extractExpiresAt(tokenSet.access_token),
          };
          setTokens(newTokens);

          if (tokenSet.id_token) {
            const claims = decodeJwtPayload(tokenSet.id_token) as IdTokenClaims;
            let profile: OidcUser | null = null;
            if (fetchProfileRef.current) {
              profile = await fetchUserProfile(discovery, tokenSet.access_token, signal);
            }
            setUser({ claims, profile });
          }

          setIsAuthenticated(true);
          const returnTo = authState.returnTo ?? "/";
          clearAuthState();
          if (onLoginRef.current) {
            onLoginRef.current(returnTo);
          } else {
            window.history.replaceState({}, "", returnTo);
          }
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        onErrorRef.current?.(err);
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [fetchUserProfile]);

  const login = useCallback(
    async (options?: LoginOptions) => {
      const discovery = discoveryRef.current;
      if (!discovery) return;

      const pkce = await generatePkce();
      const state = generateState();
      const nonce = generateNonce();

      const returnTo = options?.returnTo
        ?? window.location.pathname + window.location.search + window.location.hash;

      saveAuthState({
        codeVerifier: pkce.verifier,
        state,
        nonce,
        redirectUri: configRef.current.redirectUri ?? "",
        returnTo,
      });

      const url = buildAuthUrl(discovery, configRef.current, pkce, state, nonce, options?.extraParams);
      window.location.href = url;
    },
    [],
  );

  const logout = useCallback(() => {
    const discovery = discoveryRef.current;
    const idToken = tokens.id;

    setUser(null);
    setTokens(EMPTY_TOKENS);
    setIsAuthenticated(false);
    setError(null);

    if (discovery) {
      const logoutUrl = buildLogoutUrl(
        discovery,
        idToken ?? undefined,
        configRef.current.postLogoutRedirectUri,
      );
      if (logoutUrl) {
        window.location.href = logoutUrl;
        return;
      }
    }
  }, [tokens.id]);

  const refresh = useCallback(async () => {
    const discovery = discoveryRef.current;
    const refreshToken = tokens.refresh;

    if (!discovery || !refreshToken) {
      throw new Error("No refresh token available");
    }

    const req = buildRefreshRequest(discovery, configRef.current, refreshToken);
    const data = await executeFetch(req);
    const tokenSet = parseTokenResponse(data);

    const newTokens: AuthTokens = {
      access: tokenSet.access_token,
      id: tokenSet.id_token ?? null,
      refresh: tokenSet.refresh_token ?? null,
      expiresAt: extractExpiresAt(tokenSet.access_token),
    };
    setTokens(newTokens);

    if (tokenSet.id_token) {
      const claims = decodeJwtPayload(tokenSet.id_token) as IdTokenClaims;
      let profile: OidcUser | null = user?.profile ?? null;
      if (fetchProfileRef.current) {
        profile = await fetchUserProfile(discovery, tokenSet.access_token);
      }
      setUser({ claims, profile });
    }

    setIsAuthenticated(true);
    setError(null);
  }, [tokens.refresh, user?.profile, fetchUserProfile]);

  const doFetchProfile = useCallback(async () => {
    const discovery = discoveryRef.current;
    if (!discovery || !tokens.access) {
      throw new Error("No access token available");
    }

    const profile = await fetchUserProfile(discovery, tokens.access);
    setUser((prev) => (prev ? { ...prev, profile } : null));
  }, [tokens.access, fetchUserProfile]);

  const actions = useMemo(
    () => ({ login, logout, refresh, fetchProfile: doFetchProfile }),
    [login, logout, refresh, doFetchProfile],
  );

  const value: AuthContextValue = useMemo(
    () => ({ config, user, isAuthenticated, isLoading, error, tokens, actions }),
    [config, user, isAuthenticated, isLoading, error, tokens, actions],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
