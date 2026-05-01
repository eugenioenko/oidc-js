import Controller from '@ember/controller';
import { service } from '@ember/service';
import { action } from '@ember/object';

export default class IndexController extends Controller {
  @service oidc;

  get audString() {
    const aud = this.oidc.user?.claims?.aud;
    if (Array.isArray(aud)) return JSON.stringify(aud);
    return aud ?? '';
  }

  get emailDisplay() {
    return this.oidc.user?.profile?.email ?? 'no profile';
  }

  get profileNullString() {
    return this.oidc.user?.profile === null ? 'true' : 'false';
  }

  get accessTokenStatus() {
    return this.oidc.tokens.access ? 'present' : 'missing';
  }

  get refreshTokenStatus() {
    return this.oidc.tokens.refresh ? 'present' : 'missing';
  }

  get idTokenStatus() {
    return this.oidc.tokens.id ? 'present' : 'missing';
  }

  get expiresAtDisplay() {
    return this.oidc.tokens.expiresAt ?? 'none';
  }

  @action
  login() {
    this.oidc.login();
  }

  @action
  logout() {
    this.oidc.logout();
  }

  @action
  refreshTokens() {
    this.oidc.refresh();
  }
}
