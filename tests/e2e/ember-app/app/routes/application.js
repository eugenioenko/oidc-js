import Route from '@ember/routing/route';
import { service } from '@ember/service';

export default class ApplicationRoute extends Route {
  @service oidc;
  @service router;

  async beforeModel() {
    const fetchProfile = localStorage.getItem('e2e-fetchProfile') !== 'false';

    this.oidc.configure({
      config: {
        issuer: 'http://localhost:9999/oauth2',
        clientId: 'e2e-test-app',
        redirectUri: 'http://localhost:5173/callback',
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        postLogoutRedirectUri: 'http://localhost:5173',
      },
      fetchProfile,
      onLogin: (returnTo) => {
        this.router.replaceWith(returnTo);
      },
      onError: (error) => {
        console.error('OIDC error:', error);
      },
    });

    await this.oidc.setup();
  }
}
