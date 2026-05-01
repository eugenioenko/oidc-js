import { createRoot } from "react-dom/client";
import { BrowserRouter, useNavigate } from "react-router";
import { AuthProvider } from "oidc-js-react";
import { useCallback } from "react";
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
  const navigate = useNavigate();
  const onLogin = useCallback((returnTo: string) => {
    navigate(returnTo, { replace: true });
  }, [navigate]);

  return (
    <AuthProvider config={config} fetchProfile={fetchProfile} onLogin={onLogin}>
      <App />
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Root />
  </BrowserRouter>,
);
