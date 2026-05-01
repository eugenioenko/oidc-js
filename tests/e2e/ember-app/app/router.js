import EmberRouter from '@ember/routing/router';
import config from 'e2e-ember-app/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  this.route('callback');
  this.route('protected-a');
  this.route('protected-b');
});
