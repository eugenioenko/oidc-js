import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { OidcClient, BrowserStorage, type OidcConfig, type OidcUser } from "oidc-js";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: OidcUser | null;
  accessToken: string | null;
  login: (extraParams?: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  client: OidcClient;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  config: OidcConfig;
  children: ReactNode;
  onCallback?: (url: string) => void;
}

export function AuthProvider({ config, children, onCallback }: AuthProviderProps) {
  const [client] = useState(
    () =>
      new OidcClient({
        storage: new BrowserStorage(sessionStorage),
        ...config,
      })
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<OidcUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const url = window.location.href;
    const params = new URL(url).searchParams;

    if (params.has("code") && params.has("state")) {
      client
        .handleCallback(url)
        .then(() => {
          setUser(client.getUser());
          setAccessToken(client.getAccessToken());
          setIsAuthenticated(true);
          const cleanUrl = url.split("?")[0]!;
          window.history.replaceState({}, "", cleanUrl);
          onCallback?.(cleanUrl);
        })
        .catch((err) => {
          console.error("OIDC callback failed:", err);
        })
        .finally(() => setIsLoading(false));
    } else {
      setUser(client.getUser());
      setAccessToken(client.getAccessToken());
      setIsAuthenticated(client.isAuthenticated());
      setIsLoading(false);
    }
  }, [client, onCallback]);

  const login = useCallback(
    async (extraParams?: Record<string, string>) => {
      const url = await client.buildAuthUrl(extraParams);
      window.location.href = url;
    },
    [client]
  );

  const logout = useCallback(async () => {
    const logoutUrl = await client.buildLogoutUrl();
    client.clearTokens();
    setUser(null);
    setAccessToken(null);
    setIsAuthenticated(false);

    if (logoutUrl) {
      window.location.href = logoutUrl;
    }
  }, [client]);

  return (
    <AuthContext value={{
      isAuthenticated,
      isLoading,
      user,
      accessToken,
      login,
      logout,
      client,
    }}>
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
