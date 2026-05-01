import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { oidcPlugin } from "oidc-js-vue";
import App from "./App.vue";
import Home from "./views/Home.vue";
import Callback from "./views/Callback.vue";
import ProtectedA from "./views/ProtectedA.vue";
import ProtectedB from "./views/ProtectedB.vue";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    { path: "/callback", component: Callback },
    { path: "/protected-a", component: ProtectedA },
    { path: "/protected-b", component: ProtectedB },
  ],
});

const app = createApp(App);

app.use(oidcPlugin, {
  config: {
    issuer: "http://localhost:9999/oauth2",
    clientId: "e2e-test-app",
    redirectUri: "http://localhost:5173/callback",
    scopes: ["openid", "profile", "email", "offline_access"],
    postLogoutRedirectUri: "http://localhost:5173",
  },
  fetchProfile,
  onLogin(returnTo: string) {
    router.replace(returnTo);
  },
});

app.use(router);
app.mount("#app");
