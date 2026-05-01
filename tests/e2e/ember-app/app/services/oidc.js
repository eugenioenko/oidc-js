import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { OidcService as OidcServiceCore } from 'oidc-js-ember';

export default class OidcServiceEmber extends Service {
  @tracked user = null;
  @tracked isAuthenticated = false;
  @tracked isLoading = true;
  @tracked error = null;
  @tracked tokens = { access: null, id: null, refresh: null, expiresAt: null };

  _core = null;

  configure({ config, fetchProfile, onLogin, onError }) {
    this._core = new OidcServiceCore({ config, fetchProfile, onLogin, onError });
  }

  async setup() {
    if (!this._core) return;

    this._core.subscribe(() => {
      this.user = this._core.user;
      this.isAuthenticated = this._core.isAuthenticated;
      this.isLoading = this._core.isLoading;
      this.error = this._core.error;
      this.tokens = this._core.tokens;
    });

    await this._core.setup();

    this.user = this._core.user;
    this.isAuthenticated = this._core.isAuthenticated;
    this.isLoading = this._core.isLoading;
    this.error = this._core.error;
    this.tokens = this._core.tokens;
  }

  async login(options) {
    await this._core?.login(options);
  }

  logout() {
    this._core?.logout();
  }

  async refresh() {
    await this._core?.refresh();
  }

  async fetchProfile() {
    await this._core?.fetchProfile();
  }

  willDestroy() {
    super.willDestroy();
    this._core?.teardown();
  }
}
