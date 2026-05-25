import { expect } from 'chai';
import sinon from 'sinon';
import { Command as CsCommand } from '@contentstack/cli-command';
import * as cliUtilities from '@contentstack/cli-utilities';
import { BaseCommand } from '../../src/base-command';

/** Concrete command for exercising BaseCommand without production commands. */
class TestExportCommand extends BaseCommand {
  static id = 'cm:test-export-cmd';
  static description = 'Unit test command';
  async run(): Promise<void> {
    // intentionally empty
  }

  public buildContext(apiKey?: string) {
    return this.createCommandContext(apiKey);
  }

  public async exposeCatch(err: Error & { exitCode?: number }) {
    return this.catch(err);
  }

  public async exposeFinally(err: Error | undefined) {
    return this.finally(err);
  }
}

class CommandWithoutStaticId extends BaseCommand {
  static description = 'No static id';
  async run(): Promise<void> {}

  public buildContext() {
    return this.createCommandContext();
  }
}

const minimalConfig = { bin: 'csdx' } as any;

describe('BaseCommand', () => {
  describe('class definition', () => {
    it('should be an abstract class that extends Command', () => {
      expect(BaseCommand).to.be.a('function');
      expect(BaseCommand.prototype).to.have.property('init');
      expect(BaseCommand.prototype).to.have.property('catch');
      expect(BaseCommand.prototype).to.have.property('finally');
    });

    it('should have createCommandContext method', () => {
      expect(BaseCommand.prototype).to.have.property('createCommandContext');
    });
  });

  describe('createCommandContext', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(cliUtilities.configHandler, 'get').callsFake((key: string) => {
        const map: Record<string, string> = {
          userUid: 'user-uid-1',
          email: 'test@example.com',
          oauthOrgUid: 'org-uid-1',
        };
        return map[key];
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should map configHandler fields and command id', () => {
      const cmd = new TestExportCommand([], minimalConfig);
      const ctx = cmd.buildContext();
      expect(ctx.command).to.equal('cm:test-export-cmd');
      expect(ctx.module).to.equal('export-to-csv');
      expect(ctx.userId).to.equal('user-uid-1');
      expect(ctx.email).to.equal('test@example.com');
      expect(ctx.orgId).to.equal('org-uid-1');
      expect(ctx.apiKey).to.equal('');
    });

    it('should set apiKey when provided', () => {
      const cmd = new TestExportCommand([], minimalConfig);
      const ctx = cmd.buildContext('stack-api-key');
      expect(ctx.apiKey).to.equal('stack-api-key');
    });

    it('should fall back to default command id when this.id is missing', () => {
      const cmd = new CommandWithoutStaticId([], minimalConfig);
      (cmd as any).id = undefined;
      const ctx = cmd.buildContext();
      expect(ctx.command).to.equal('cm:export-to-csv');
    });

    it('should use empty strings when config keys are missing', () => {
      (sandbox as sinon.SinonSandbox).restore();
      sandbox = sinon.createSandbox();
      sandbox.stub(cliUtilities.configHandler, 'get').returns(undefined);
      const cmd = new TestExportCommand([], minimalConfig);
      const ctx = cmd.buildContext();
      expect(ctx.userId).to.equal('');
      expect(ctx.email).to.equal('');
      expect(ctx.orgId).to.equal('');
    });
  });

  describe('init', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(CsCommand.prototype as any, 'init').resolves(undefined);
      sandbox.stub(cliUtilities.configHandler, 'get').callsFake((key: string) => {
        const map: Record<string, string> = {
          userUid: 'u1',
          email: 'e1@test.com',
          oauthOrgUid: 'o1',
        };
        return map[key];
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should await parent init and assign commandContext', async () => {
      const cmd = new TestExportCommand([], minimalConfig);
      await cmd.init();
      expect(cmd.commandContext.userId).to.equal('u1');
      expect(cmd.commandContext.email).to.equal('e1@test.com');
    });
  });

  describe('catch and finally', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      sandbox.stub(CsCommand.prototype as any, 'init').resolves(undefined);
      sandbox.stub(cliUtilities.configHandler, 'get').callsFake((key: string) => {
        const map: Record<string, string> = { userUid: 'u', email: 'e', oauthOrgUid: 'o' };
        return map[key];
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should delegate catch to parent Command', async () => {
      const parentCatch = sandbox.stub(CsCommand.prototype as any, 'catch').resolves(undefined);
      const cmd = new TestExportCommand([], minimalConfig);
      await cmd.init();
      const err = new Error('test failure') as Error & { exitCode?: number };
      await cmd.exposeCatch(err);
      expect(parentCatch.calledOnceWithExactly(err)).to.be.true;
    });

    it('should delegate finally to parent Command', async () => {
      const parentFinally = sandbox.stub(CsCommand.prototype as any, 'finally').resolves(undefined);
      const cmd = new TestExportCommand([], minimalConfig);
      await cmd.init();
      const err = new Error('x');
      await cmd.exposeFinally(err);
      expect(parentFinally.calledOnceWithExactly(err)).to.be.true;
    });

    it('should pass undefined to finally when no error', async () => {
      const parentFinally = sandbox.stub(CsCommand.prototype as any, 'finally').resolves(undefined);
      const cmd = new TestExportCommand([], minimalConfig);
      await cmd.init();
      await cmd.exposeFinally(undefined);
      expect(parentFinally.calledOnceWithExactly(undefined)).to.be.true;
    });
  });
});
