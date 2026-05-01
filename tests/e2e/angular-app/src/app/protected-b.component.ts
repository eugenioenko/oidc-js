import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-protected-b",
  standalone: true,
  imports: [RouterLink],
  template: `
    <div data-testid="protected-b">Protected content b</div>
    <nav>
      <a data-testid="link-home" routerLink="/">Home</a>
      <a data-testid="link-protected-a" routerLink="/protected-a">Protected A</a>
      <a data-testid="link-protected-b" routerLink="/protected-b">Protected B</a>
    </nav>
  `,
})
export class ProtectedBComponent {}
