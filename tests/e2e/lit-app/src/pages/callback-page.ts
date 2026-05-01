import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("callback-page")
export class CallbackPage extends LitElement {
  render() {
    return html`<div data-testid="auth-loading">Processing login...</div>`;
  }

  createRenderRoot() {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "callback-page": CallbackPage;
  }
}
