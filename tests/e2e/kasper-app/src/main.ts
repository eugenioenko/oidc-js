import { App } from "kasper-js";
import { AppRoot } from "./components/App.kasper";
import { AuthProvider, RequireAuth } from "oidc-js-kasper";

App({
  root: document.getElementById("root")!,
  entry: "app-root",
  registry: {
    "app-root": { component: AppRoot },
    "auth-provider": { component: AuthProvider },
    "require-auth": { component: RequireAuth },
  },
});
