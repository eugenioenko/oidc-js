import { Component, inject } from "@angular/core";
import { AuthService } from "oidc-js-angular";

@Component({
  selector: "app-callback",
  standalone: true,
  template: `
    @if (auth.error()) {
      <div data-testid="auth-error">Error: {{ auth.error()!.message }}</div>
    } @else {
      <div data-testid="auth-loading">Processing login...</div>
    }
  `,
})
export class CallbackComponent {
  readonly auth = inject(AuthService);
}
