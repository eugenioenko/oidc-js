import { render } from "preact";
import { AuthProvider } from "oidc-js-preact";
import { route } from "preact-router";
import { useCallback } from "preact/hooks";
import { App } from "./App.js";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";
const autoRefreshInterval = Number(localStorage.getItem("e2e-autoRefreshInterval"));

const idpPort = import.meta.env.VITE_IDP_PORT ?? "9999";
const appPort = import.meta.env.VITE_APP_PORT ?? "5173";

const config = {
  issuer: `http://localhost:${idpPort}/oauth2`,
  clientId: "e2e-test-app",
  redirectUri: `http://localhost:${appPort}/callback`,
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: `http://localhost:${appPort}`,
  ...(autoRefreshInterval ? { autoRefreshInterval } : {}),
};

function Root() {
  const onLogin = useCallback((returnTo: string) => {
    route(returnTo, true);
  }, []);

  return (
    <AuthProvider config={{ ...config, fetchProfile }} onLogin={onLogin}>
      <App />
    </AuthProvider>
  );
}

render(<Root />, document.getElementById("root")!);
