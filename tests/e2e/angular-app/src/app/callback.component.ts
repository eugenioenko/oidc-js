import { Component } from "@angular/core";

@Component({
  selector: "app-callback",
  standalone: true,
  template: `<div data-testid="auth-loading">Processing login...</div>`,
})
export class CallbackComponent {}
