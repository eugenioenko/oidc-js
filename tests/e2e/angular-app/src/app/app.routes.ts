import type { Routes } from "@angular/router";
import { authGuard } from "oidc-js-angular";
import { HomeComponent } from "./home.component";
import { CallbackComponent } from "./callback.component";
import { ProtectedAComponent } from "./protected-a.component";
import { ProtectedBComponent } from "./protected-b.component";

export const routes: Routes = [
  { path: "", component: HomeComponent },
  { path: "callback", component: CallbackComponent },
  { path: "protected-a", component: ProtectedAComponent, canActivate: [authGuard] },
  { path: "protected-b", component: ProtectedBComponent, canActivate: [authGuard] },
];
