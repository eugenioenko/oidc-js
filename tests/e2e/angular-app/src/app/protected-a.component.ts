import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-protected-a",
  standalone: true,
  imports: [RouterLink],
  template: `
    <div data-testid="protected-a">Protected content a</div>
    <nav>
      <a data-testid="link-home" routerLink="/">Home</a>
      <a data-testid="link-protected-a" routerLink="/protected-a">Protected A</a>
      <a data-testid="link-protected-b" routerLink="/protected-b">Protected B</a>
    </nav>
  `,
})
export class ProtectedAComponent {}
