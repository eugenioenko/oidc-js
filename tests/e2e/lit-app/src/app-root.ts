import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { AuthController } from "oidc-js-lit";
import "./pages/home-page.js";
import "./pages/callback-page.js";
import "./pages/protected-a-page.js";
import "./pages/protected-b-page.js";

const fetchProfile = localStorage.getItem("e2e-fetchProfile") !== "false";

const config = {
  issuer: "http://localhost:9999/oauth2",
  clientId: "e2e-test-app",
  redirectUri: "http://localhost:5174/callback",
  scopes: ["openid", "profile", "email", "offline_access"],
  postLogoutRedirectUri: "http://localhost:5174",
};

@customElement("app-root")
export class AppRoot extends LitElement {
  auth = new AuthController(this, {
    config,
    fetchProfile,
    onLogin: (returnTo: string) => {
      window.history.replaceState({}, "", returnTo);
      this._path = window.location.pathname;
    },
  });

  @state()
  private _path = window.location.pathname;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("popstate", this._onPopState);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("popstate", this._onPopState);
  }

  private _onPopState = () => {
    this._path = window.location.pathname;
  };

  navigate(path: string) {
    window.history.pushState({}, "", path);
    this._path = path;
  }

  render() {
    switch (this._path) {
      case "/callback":
        return html`<callback-page></callback-page>`;
      case "/protected-a":
        return html`<protected-a-page .auth=${this.auth} .navigate=${(p: string) => this.navigate(p)}></protected-a-page>`;
      case "/protected-b":
        return html`<protected-b-page .auth=${this.auth} .navigate=${(p: string) => this.navigate(p)}></protected-b-page>`;
      default:
        return html`<home-page .auth=${this.auth} .navigate=${(p: string) => this.navigate(p)}></home-page>`;
    }
  }

  // Disable shadow DOM so data-testid attributes are visible to Playwright
  createRenderRoot() {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-root": AppRoot;
  }
}
