import { stub, SinonStub } from 'sinon';
import { configHandler } from '@contentstack/cli-utilities';

/**
 * Stubs configHandler.get so the command's `isAuthenticated()` check passes and a
 * region/host resolves, letting command run() paths be exercised in a clean
 * (logged-out) workspace without a real login or network call. Caller restores it.
 */
export function stubAuthenticatedEnv(): SinonStub {
  return stub(configHandler, 'get').callsFake((key: string) => {
    if (key === 'authorisationType') return 'BASIC';
    if (key === 'region')
      return { cma: 'https://api.contentstack.io', cda: 'https://cdn.contentstack.io', uiHost: '', name: 'NA' };
    return undefined;
  });
}
