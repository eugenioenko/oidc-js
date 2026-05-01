import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AuthController, RequireAuthController } from "oidc-js-lit";

@customElement("protected-b-page")
export class ProtectedBPage extends LitElement {
  @property({ attribute: false })
  auth!: AuthController;

  @property({ attribute: false })
  navigate!: (path: string) => void;

  private guard!: RequireAuthController;

  connectedCallback() {
    this.guard = new RequireAuthController(this, { auth: this.auth });
    super.connectedCallback();
  }

  render() {
    if (!this.guard.authorized) {
      return html`<div data-testid="auth-loading">Refreshing...</div>`;
    }

    return html`
      <div data-testid="protected-b">
        Protected content b
      </div>
      <nav>
        <a data-testid="link-home" href="/" @click=${(e: Event) => { e.preventDefault(); this.navigate("/"); }}>Home</a>
        <a data-testid="link-protected-a" href="/protected-a" @click=${(e: Event) => { e.preventDefault(); this.navigate("/protected-a"); }}>Protected A</a>
        <a data-testid="link-protected-b" href="/protected-b" @click=${(e: Event) => { e.preventDefault(); this.navigate("/protected-b"); }}>Protected B</a>
      </nav>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "protected-b-page": ProtectedBPage;
  }
}
