import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  type ParentComponent,
} from "solid-js";
import { OidcClient, type AuthState, type LoginOptions } from "oidc-js";
import type { OidcConfig } from "oidc-js-core";
import type { AuthContextValue } from "./types.js";

const AuthContext = createContext<AuthContextValue>();

/**
 * Props for the {@link AuthProvider} component.
 */
interface AuthProviderProps {
  /** OIDC configuration including issuer, clientId, and redirectUri. */
  config: OidcConfig;
  /** Whether to fetch the userinfo profile after token exchange. Defaults to true. */
  fetchProfile?: boolean;
  /** Callback invoked after a successful login with the returnTo path. */
  onLogin?: (returnTo: string) => void;
  /** Callback invoked when an authentication error occurs. */
  onError?: (error: Error) => void;
}

const INITIAL_STATE: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  tokens: { access: null, id: null, refresh: null, expiresAt: null },
};

/**
 * SolidJS context provider that manages OIDC authentication state.
 *
 * Creates an {@link OidcClient} instance, initializes it on mount,
 * subscribes to state changes via signals, and cleans up on unmount.
 *
 * @example
 * ```tsx
 * <AuthProvider config={config} onLogin={(returnTo) => navigate(returnTo, { replace: true })}>
 *   <App />
 * </AuthProvider>
 * ```
 */
export const AuthProvider: ParentComponent<AuthProviderProps> = (props) => {
  const [state, setState] = createSignal<AuthState>(INITIAL_STATE);

  let client: OidcClient | null = null;

  onMount(() => {
    const oidcClient = new OidcClient({
      ...props.config,
      fetchProfile: props.fetchProfile ?? true,
    });
    client = oidcClient;

    const unsub = oidcClient.subscribe((newState) => {
      setState(newState);
    });

    oidcClient.init().then(({ returnTo }) => {
      const s = oidcClient.state;
      if (s.error) props.onError?.(s.error);
      if (returnTo) {
        if (props.onLogin) {
          props.onLogin(returnTo);
        } else {
          window.history.replaceState({}, "", returnTo);
        }
      }
    });

    onCleanup(() => {
      unsub();
      oidcClient.destroy();
    });
  });

  const login = async (options?: LoginOptions) => {
    await client?.login(options);
  };

  const logout = () => {
    client?.logout();
  };

  const refresh = async () => {
    await client?.refresh();
  };

  const doFetchProfile = async () => {
    await client?.fetchProfile();
  };

  const actions = { login, logout, refresh, fetchProfile: doFetchProfile };

  const value: AuthContextValue = {
    get config() {
      return props.config;
    },
    get user() {
      return state().user;
    },
    get isAuthenticated() {
      return state().isAuthenticated;
    },
    get isLoading() {
      return state().isLoading;
    },
    get error() {
      return state().error;
    },
    get tokens() {
      return state().tokens;
    },
    actions,
  };

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
};

/**
 * SolidJS accessor hook that returns the current authentication context.
 *
 * Must be called within an {@link AuthProvider}. Returns an object with
 * reactive getter properties backed by signals.
 *
 * @returns The current {@link AuthContextValue}.
 * @throws Error if called outside of an AuthProvider.
 *
 * @example
 * ```tsx
 * function Profile() {
 *   const auth = useAuth();
 *   return <div>{auth.user?.claims.sub}</div>;
 * }
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
