import { createRoot } from "react-dom/client";
import { AuthProvider } from "oidc-js-react";
import { App } from "./App.js";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";

const config = {
  issuer: "http://localhost:9999/oauth2",
  clientId: "e2e-test-app",
  redirectUri: "http://localhost:5173/callback",
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: "http://localhost:5173",
};

createRoot(document.getElementById("root")!).render(
  <AuthProvider config={config} fetchProfile={fetchProfile}>
    <App />
  </AuthProvider>,
);
