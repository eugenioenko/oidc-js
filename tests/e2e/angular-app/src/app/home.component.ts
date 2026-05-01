import { Component, inject, computed } from "@angular/core";
import { RouterLink } from "@angular/router";
import { AuthService } from "oidc-js-angular";

@Component({
  selector: "app-home",
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (auth.isLoading()) {
      <div data-testid="auth-loading">Loading...</div>
    } @else if (auth.error()) {
      <div data-testid="auth-error">Error: {{ auth.error()!.message }}</div>
    } @else if (!auth.isAuthenticated()) {
      <div data-testid="unauthenticated">
        <h1>Not logged in</h1>
        <button data-testid="login-button" (click)="login()">Login</button>
      </div>
    } @else {
      <div data-testid="authenticated">
        <h1>Logged in</h1>
        <div data-testid="user-sub">{{ auth.user()?.claims?.sub }}</div>
        <div data-testid="user-iss">{{ auth.user()?.claims?.iss }}</div>
        <div data-testid="user-aud">{{ audDisplay() }}</div>
        <div data-testid="user-exp">{{ auth.user()?.claims?.exp }}</div>
        <div data-testid="user-iat">{{ auth.user()?.claims?.iat }}</div>
        <div data-testid="user-email">{{ auth.user()?.profile?.email ?? 'no profile' }}</div>
        <div data-testid="user-profile-null">{{ auth.user()?.profile === null ? 'true' : 'false' }}</div>
        <div data-testid="access-token">{{ auth.tokens().access ? 'present' : 'missing' }}</div>
        <div data-testid="refresh-token">{{ auth.tokens().refresh ? 'present' : 'missing' }}</div>
        <div data-testid="access-token-value" style="display: none">{{ auth.tokens().access ?? '' }}</div>
        <div data-testid="refresh-token-value" style="display: none">{{ auth.tokens().refresh ?? '' }}</div>
        <div data-testid="id-token">{{ auth.tokens().id ? 'present' : 'missing' }}</div>
        <div data-testid="expires-at">{{ auth.tokens().expiresAt ?? 'none' }}</div>
        <button data-testid="logout-button" (click)="logout()">Logout</button>
        <button data-testid="refresh-button" (click)="refresh()">Refresh</button>
        <nav>
          <a data-testid="link-protected-a" routerLink="/protected-a">Protected A</a>
          <a data-testid="link-protected-b" routerLink="/protected-b">Protected B</a>
        </nav>
      </div>
    }
  `,
})
export class HomeComponent {
  readonly auth = inject(AuthService);

  readonly audDisplay = computed(() => {
    const aud = this.auth.user()?.claims?.aud;
    return typeof aud === "string" ? aud : JSON.stringify(aud);
  });

  login() {
    this.auth.login();
  }

  logout() {
    this.auth.logout();
  }

  refresh() {
    this.auth.refresh().catch(() => {});
  }
}
