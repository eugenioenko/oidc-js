import { useNavigate } from "@solidjs/router";
import { AuthProvider } from "oidc-js-solid";
import type { ParentComponent } from "solid-js";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";
const idpPort = import.meta.env.VITE_IDP_PORT ?? "9999";
const appPort = import.meta.env.VITE_APP_PORT ?? "5173";

const config = {
  issuer: `http://localhost:${idpPort}/oauth2`,
  clientId: "e2e-test-app",
  redirectUri: `http://localhost:${appPort}/callback`,
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: `http://localhost:${appPort}`,
};

export const App: ParentComponent = (props) => {
  const navigate = useNavigate();
  const onLogin = (returnTo: string) => {
    navigate(returnTo, { replace: true });
  };

  return (
    <AuthProvider config={config} fetchProfile={fetchProfile} onLogin={onLogin}>
      {props.children}
    </AuthProvider>
  );
};
