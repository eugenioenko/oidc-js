import { render } from "preact";
import { AuthProvider } from "oidc-js-preact";
import { route } from "preact-router";
import { useCallback } from "preact/hooks";
import { App } from "./App.js";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";

const config = {
  issuer: "http://localhost:9999/oauth2",
  clientId: "e2e-test-app",
  redirectUri: "http://localhost:5173/callback",
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: "http://localhost:5173",
};

function Root() {
  const onLogin = useCallback((returnTo: string) => {
    route(returnTo, true);
  }, []);

  return (
    <AuthProvider config={config} fetchProfile={fetchProfile} onLogin={onLogin}>
      <App />
    </AuthProvider>
  );
}

render(<Root />, document.getElementById("root")!);
