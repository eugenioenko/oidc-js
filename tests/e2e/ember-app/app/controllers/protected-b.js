import Controller from '@ember/controller';
import { service } from '@ember/service';

export default class ProtectedBController extends Controller {
  @service oidc;
}
