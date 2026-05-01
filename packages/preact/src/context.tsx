import { createContext } from "preact";
import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "preact/hooks";
import type { ComponentChildren } from "preact";
import { OidcClient, type AuthState, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthContextValue } from "./types.js";

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  config: OidcConfig;
  fetchProfile?: boolean;
  onLogin?: (returnTo: string) => void;
  onError?: (error: Error) => void;
  children: ComponentChildren;
}

/**
 * Provides OIDC authentication state and actions to all child components.
 *
 * Wraps the application (or a subtree) to make {@link useAuth} available.
 * Handles OIDC discovery, callback processing, and token lifecycle automatically.
 *
 * @param props - Provider configuration including OIDC config, optional callbacks, and children.
 */
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the current authentication context value.
 *
 * Must be called inside an {@link AuthProvider}. Provides access to the current
 * user, authentication state, tokens, and actions (login, logout, refresh, fetchProfile).
 *
 * @returns The current {@link AuthContextValue}.
 * @throws Error if called outside of an AuthProvider.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
