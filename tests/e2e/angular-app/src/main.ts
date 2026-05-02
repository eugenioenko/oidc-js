import "zone.js";
import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter } from "@angular/router";
import { provideAuth } from "oidc-js-angular";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";

const config = {
  issuer: "http://localhost:9999/oauth2",
  clientId: "e2e-test-app",
  redirectUri: "http://localhost:5173/callback",
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: "http://localhost:5173",
};

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideAuth({
      config,
      fetchProfile,
    }),
  ],
}).catch((err) => console.error(err));
