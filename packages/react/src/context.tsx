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
import { OidcClient, type AuthState, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthContextValue } from "./types.js";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  config: OidcConfig;
  fetchProfile?: boolean;
  onLogin?: (returnTo: string) => void;
  onError?: (error: Error) => void;
  children: ReactNode;
}

export function AuthProvider({
  config,
  fetchProfile = true,
  onLogin,
  onError,
  children,
}: AuthProviderProps) {
  const clientRef = useRef<OidcClient | null>(null);
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    tokens: { access: null, id: null, refresh: null, expiresAt: null },
  }));

  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const client = new OidcClient({ ...config, fetchProfile });
    clientRef.current = client;

    const unsub = client.subscribe(setState);

    client.init().then(({ returnTo }) => {
      const s = client.state;
      if (s.error) onErrorRef.current?.(s.error);
      if (returnTo) {
        onLoginRef.current
          ? onLoginRef.current(returnTo)
          : window.history.replaceState({}, "", returnTo);
      }
    });

    return () => {
      unsub();
      client.destroy();
    };
  }, [config, fetchProfile]);

  const login = useCallback(
    async (options?: LoginOptions) => {
      await clientRef.current?.login(options);
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
    () => ({ config, ...state, actions }),
    [config, state, actions],
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
