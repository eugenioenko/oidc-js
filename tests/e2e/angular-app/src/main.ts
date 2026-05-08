import "zone.js";
import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideAuth } from "oidc-js-angular";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";
const autoRefreshInterval = Number(localStorage.getItem("e2e-autoRefreshInterval"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const viteEnv = (import.meta as any).env ?? {};
const idpPort = viteEnv.VITE_IDP_PORT ?? "9999";
const appPort = viteEnv.VITE_APP_PORT ?? "5173";

const config = {
  issuer: `http://localhost:${idpPort}/oauth2`,
  clientId: "e2e-test-app",
  redirectUri: `http://localhost:${appPort}/callback`,
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: `http://localhost:${appPort}`,
  autoRefreshInterval: autoRefreshInterval || undefined,
};

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAuth({
      config: { ...config, fetchProfile },
    }),
  ],
}).catch((err) => console.error(err));
