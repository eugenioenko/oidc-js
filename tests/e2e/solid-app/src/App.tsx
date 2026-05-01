import { useNavigate } from "@solidjs/router";
import { AuthProvider } from "oidc-js-solid";
import type { ParentComponent } from "solid-js";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";

const config = {
  issuer: "http://localhost:9999/oauth2",
  clientId: "e2e-test-app",
  redirectUri: "http://localhost:5173/callback",
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: "http://localhost:5173",
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
