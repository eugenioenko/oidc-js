import Route from '@ember/routing/route';
import { service } from '@ember/service';

export default class ProtectedARoute extends Route {
  @service oidc;

  async beforeModel() {
    if (this.oidc.isLoading) return;

    if (this.oidc.isAuthenticated) {
      const isExpired =
        this.oidc.tokens.expiresAt !== null &&
        this.oidc.tokens.expiresAt <= Date.now();

      if (!isExpired) return;

      if (this.oidc.tokens.refresh) {
        try {
          await this.oidc.refresh();
          return;
        } catch {
          // refresh failed
        }
      }
    }

    await this.oidc.login({ returnTo: '/protected-a' });
  }
}
