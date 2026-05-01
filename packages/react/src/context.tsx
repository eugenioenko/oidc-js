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
import { OidcClient, type OidcClientConfig, type AuthTokens, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthContextValue, AuthUser } from "./types.js";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  config: OidcConfig;
  fetchProfile?: boolean;
  onLogin?: (returnTo: string) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
}

const EMPTY_TOKENS: AuthTokens = { access: null, id: null, refresh: null, expiresAt: null };

export function AuthProvider({
  config,
  fetchProfile = true,
  onLogin,
  onError,
  children,
}: AuthProviderProps) {
  const clientRef = useRef<OidcClient | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [tokens, setTokens] = useState<AuthTokens>(EMPTY_TOKENS);

  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const clientConfig: OidcClientConfig = { ...config, fetchProfile };
    const client = new OidcClient(clientConfig);
    clientRef.current = client;

    const unsub = client.subscribe((state) => {
      setUser(state.user);
      setIsAuthenticated(state.isAuthenticated);
      setIsLoading(state.isLoading);
      setError(state.error);
      setTokens(state.tokens);
    });

    client.init().then(({ returnTo }) => {
      const state = client.state;
      if (state.error) {
        onErrorRef.current?.(state.error);
      }
      if (returnTo) {
        if (onLoginRef.current) {
          onLoginRef.current(returnTo);
        } else {
          window.history.replaceState({}, "", returnTo);
        }
      }
    });

    return () => {
      unsub();
      client.destroy();
    };
  }, [config, fetchProfile]);

  const login = useCallback(
    async (options?: LoginOptions) => {
      clientRef.current?.login(options);
    },
    [],
  );

  const logout = useCallback(() => {
    clientRef.current?.logout();
  }, []);

  const refresh = useCallback(async () => {
    await clientRef.current?.refresh();
  }, []);

  const doFetchProfile = useCallback(async () => {
    await clientRef.current?.fetchProfile();
  }, []);

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
