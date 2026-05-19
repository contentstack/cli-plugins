import { expect } from 'chai';
import sinon from 'sinon';
import * as cliUtilities from '@contentstack/cli-utilities';
import * as apiClient from '../../../src/utils/api-client';
import * as errorHandler from '../../../src/utils/error-handler';
import { messages } from '../../../src/messages';

type InquirerMod = typeof import('@inquirer/prompts');

function uncacheResolved(id: string): void {
  delete require.cache[id];
}

/** @inquirer/prompts exports select/checkbox/confirm via getters; replace with data properties so stubs apply. */
function setPromptExport(
  promptsMod: InquirerMod,
  key: 'select' | 'checkbox' | 'confirm',
  fn: (...args: unknown[]) => unknown,
): void {
  Object.defineProperty(promptsMod, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value: fn,
  });
}

/** Reload @inquirer/prompts and interactive so interactive uses patched prompt functions. */
function loadInteractiveWithInquirerSetup(setupPrompts: (p: InquirerMod) => void): typeof import('../../../src/utils/interactive') {
  uncacheResolved(require.resolve('../../../src/utils/interactive'));
  uncacheResolved(require.resolve('@inquirer/prompts'));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const promptsMod = require('@inquirer/prompts') as InquirerMod;
  setupPrompts(promptsMod);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(require.resolve('../../../src/utils/interactive')) as typeof import('../../../src/utils/interactive');
}

describe('interactive', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('module shape', () => {
    it('should export all interactive functions', () => {
      const m = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves(messages.ACTION_EXPORT_ENTRIES) as any);
      });
      expect(m.startupQuestions).to.be.a('function');
      expect(m.chooseOrganization).to.be.a('function');
      expect(m.chooseStack).to.be.a('function');
      expect(m.chooseBranch).to.be.a('function');
      expect(m.chooseContentType).to.be.a('function');
      expect(m.chooseInMemContentTypes).to.be.a('function');
      expect(m.chooseLanguage).to.be.a('function');
      expect(m.chooseFallbackOptions).to.be.a('function');
      expect(m.promptContinueExport).to.be.a('function');
    });
  });

  describe('startupQuestions (5a)', () => {
    it('should return selected action', async () => {
      const { startupQuestions } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves(messages.ACTION_EXPORT_ENTRIES) as any);
      });
      const action = await startupQuestions();
      expect(action).to.equal(messages.ACTION_EXPORT_ENTRIES);
    });

    it('should call exitProgram when user chooses Exit', async () => {
      const exitStub = sandbox.stub(errorHandler, 'exitProgram');
      const { startupQuestions } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('Exit') as any);
      });
      await startupQuestions();
      expect(exitStub.calledOnce).to.equal(true);
    });
  });

  describe('chooseOrganization (5b)', () => {
    it('should use getOrganizations for default action', async () => {
      sandbox.stub(apiClient, 'getOrganizations').resolves({ Acme: 'org-1' });
      sandbox.stub(apiClient, 'getOrganizationsWhereUserIsAdmin').resolves({ AdminCo: 'org-2' });
      const { chooseOrganization } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('Acme') as any);
      });
      const client = {} as any;
      const result = await chooseOrganization(client, messages.ACTION_EXPORT_ENTRIES);
      expect((apiClient.getOrganizations as sinon.SinonStub).calledOnce).to.equal(true);
      expect((apiClient.getOrganizationsWhereUserIsAdmin as sinon.SinonStub).called).to.equal(false);
      expect(result).to.deep.equal({ name: 'Acme', uid: 'org-1' });
    });

    it('should use getOrganizationsWhereUserIsAdmin for users action', async () => {
      sandbox.stub(apiClient, 'getOrganizations').resolves({ Acme: 'org-1' });
      sandbox.stub(apiClient, 'getOrganizationsWhereUserIsAdmin').resolves({ AdminCo: 'org-2' });
      const { chooseOrganization } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('AdminCo') as any);
      });
      const client = {} as any;
      const result = await chooseOrganization(client, messages.ACTION_EXPORT_USERS);
      expect((apiClient.getOrganizationsWhereUserIsAdmin as sinon.SinonStub).calledOnce).to.equal(true);
      expect(result).to.deep.equal({ name: 'AdminCo', uid: 'org-2' });
    });

    it('should use getOrganizationsWhereUserIsAdmin for teams action string', async () => {
      sandbox.stub(apiClient, 'getOrganizationsWhereUserIsAdmin').resolves({ T: 'org-t' });
      const { chooseOrganization } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('T') as any);
      });
      const result = await chooseOrganization({} as any, 'teams');
      expect((apiClient.getOrganizationsWhereUserIsAdmin as sinon.SinonStub).calledOnce).to.equal(true);
      expect(result.uid).to.equal('org-t');
    });

    it('should exit when user cancels', async () => {
      sandbox.stub(apiClient, 'getOrganizations').resolves({ A: '1' });
      const exitStub = sandbox.stub(errorHandler, 'exitProgram');
      const { chooseOrganization } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves(messages.ACTION_CANCEL) as any);
      });
      await chooseOrganization({} as any);
      expect(exitStub.calledOnce).to.equal(true);
    });
  });

  describe('chooseStack (5c)', () => {
    it('should return stack by api key when found', async () => {
      sandbox.stub(apiClient, 'getStacks').resolves({ MyStack: 'key-123' });
      const { chooseStack } = loadInteractiveWithInquirerSetup(() => {
        /* no prompts when api key resolves */
      });
      const result = await chooseStack({} as any, 'org-1', 'key-123');
      expect(result).to.deep.equal({ name: 'MyStack', apiKey: 'key-123' });
    });

    it('should throw when stack api key not found', async () => {
      sandbox.stub(apiClient, 'getStacks').resolves({ MyStack: 'key-123' });
      const { chooseStack } = loadInteractiveWithInquirerSetup(() => {});
      try {
        await chooseStack({} as any, 'org-1', 'missing');
        expect.fail('expected throw');
      } catch (e: any) {
        expect(String(e.message)).to.include('Could not find stack');
      }
    });

    it('should prompt and return chosen stack', async () => {
      sandbox.stub(apiClient, 'getStacks').resolves({ S1: 'k1', S2: 'k2' });
      const { chooseStack } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('S2') as any);
      });
      const result = await chooseStack({} as any, 'org-1');
      expect(result).to.deep.equal({ name: 'S2', apiKey: 'k2' });
    });

    it('should exit when user cancels stack selection', async () => {
      sandbox.stub(apiClient, 'getStacks').resolves({ S1: 'k1' });
      const exitStub = sandbox.stub(errorHandler, 'exitProgram');
      const { chooseStack } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves(messages.ACTION_CANCEL) as any);
      });
      await chooseStack({} as any, 'org-1');
      expect(exitStub.calledOnce).to.equal(true);
    });
  });

  describe('chooseBranch (5d)', () => {
    it('should return selected branch uid', async () => {
      const { chooseBranch } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('br-main') as any);
      });
      const result = await chooseBranch([{ uid: 'br-main', name: 'main' } as any]);
      expect(result).to.deep.equal({ branch: 'br-main' });
    });

    it('should log and rethrow on select error', async () => {
      const err = new Error('prompt failed');
      const errStub = sandbox.stub(cliUtilities.cliux, 'error');
      const { chooseBranch } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().rejects(err) as any);
      });
      try {
        await chooseBranch([{ uid: 'b1' } as any]);
        expect.fail('expected throw');
      } catch (e: any) {
        expect(e.message).to.equal('prompt failed');
      }
      expect(errStub.calledOnce).to.equal(true);
    });
  });

  describe('chooseContentType & chooseInMemContentTypes (5d)', () => {
    it('should return checkbox selection from getContentTypes', async () => {
      sandbox.stub(apiClient, 'getContentTypes').resolves({ ct1: 'blog', ct2: 'page' } as any);
      const { chooseContentType } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'checkbox', sandbox.stub().resolves(['blog']) as any);
      });
      const result = await chooseContentType({} as any, 0);
      expect(result).to.deep.equal(['blog']);
    });

    it('should loop until at least one content type selected', async () => {
      const printStub = sandbox.stub(cliUtilities.cliux, 'print');
      const { chooseInMemContentTypes } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(
          p,
          'checkbox',
          sandbox.stub().onFirstCall().resolves([]).onSecondCall().resolves(['a']) as any,
        );
      });
      const result = await chooseInMemContentTypes(['a', 'b']);
      expect(result).to.deep.equal(['a']);
      expect(printStub.calledOnce).to.equal(true);
    });
  });

  describe('chooseLanguage & chooseFallbackOptions & promptContinueExport (5e)', () => {
    it('should return chosen language', async () => {
      sandbox.stub(apiClient, 'getLanguages').resolves({ English: 'en-us', French: 'fr-fr' } as any);
      const { chooseLanguage } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('French') as any);
      });
      const result = await chooseLanguage({} as any);
      expect(result).to.deep.equal({ name: 'French', code: 'fr-fr' });
    });

    it('should exit when language selection cancelled', async () => {
      sandbox.stub(apiClient, 'getLanguages').resolves({ English: 'en-us' } as any);
      sandbox.stub(errorHandler, 'exitProgram');
      const { chooseLanguage } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves(messages.ACTION_CANCEL) as any);
      });
      await chooseLanguage({} as any);
      expect((errorHandler.exitProgram as unknown as sinon.SinonStub).calledOnce).to.equal(true);
    });

    it('should return fallback options without locale when confirm false', async () => {
      const { chooseFallbackOptions } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'confirm', sandbox.stub().resolves(false) as any);
      });
      const result = await chooseFallbackOptions({} as any);
      expect(result).to.deep.equal({ includeFallback: false, fallbackLocale: null });
    });

    it('should load languages and set fallback locale when confirm true', async () => {
      sandbox.stub(apiClient, 'getLanguages').resolves({ English: 'en-us', German: 'de-de' } as any);
      const { chooseFallbackOptions } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'confirm', sandbox.stub().resolves(true) as any);
        setPromptExport(p, 'select', sandbox.stub().resolves('German') as any);
      });
      const result = await chooseFallbackOptions({} as any);
      expect(result.includeFallback).to.equal(true);
      expect(result.fallbackLocale).to.equal('de-de');
    });

    it('should rethrow when getLanguages fails after confirm true (catch path)', async () => {
      sandbox.stub(apiClient, 'getLanguages').rejects(new Error('lang fetch failed'));
      const { chooseFallbackOptions } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'confirm', sandbox.stub().resolves(true) as any);
      });
      try {
        await chooseFallbackOptions({} as any);
        expect.fail('expected rejection');
      } catch (e: any) {
        expect(e.message).to.equal('lang fetch failed');
      }
    });

    it('should return true when user confirms continue export', async () => {
      const { promptContinueExport } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('yes') as any);
      });
      const ok = await promptContinueExport();
      expect(ok).to.equal(true);
    });

    it('should return false when user declines', async () => {
      const { promptContinueExport } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().resolves('no') as any);
      });
      const ok = await promptContinueExport();
      expect(ok).to.equal(false);
    });

    it('should print and exit on prompt error', async () => {
      const printStub = sandbox.stub(cliUtilities.cliux, 'print');
      const exitStub = sandbox.stub(process, 'exit' as any);
      const { promptContinueExport } = loadInteractiveWithInquirerSetup((p) => {
        setPromptExport(p, 'select', sandbox.stub().rejects(new Error('tty')) as any);
      });
      await promptContinueExport();
      expect(printStub.calledOnce).to.equal(true);
      expect(exitStub.calledWith(1)).to.equal(true);
    });
  });
});
