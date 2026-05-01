import Controller from '@ember/controller';
import { service } from '@ember/service';

export default class ProtectedAController extends Controller {
  @service oidc;
}
