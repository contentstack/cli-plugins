import { expect } from 'chai';
import sinon from 'sinon';
import ExportCommand from '../../../../../src/commands/cm/stacks/export';

describe('ExportCommand', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('Flags Configuration', () => {
    it('should have all required flags defined', () => {
      const flags = ExportCommand.flags;

      expect(flags).to.have.property('stack-api-key');
      expect(flags).to.have.property('data-dir');
      expect(flags).to.have.property('alias');
      expect(flags).to.have.property('config');
      expect(flags).to.have.property('module');
      expect(flags).to.have.property('branch');
      expect(flags).to.have.property('branch-alias');
      expect(flags).to.have.property('secured-assets');
    });

    it('should have correct exclusive flags for branch', () => {
      const flags = ExportCommand.flags;

      expect(flags['branch']).to.have.property('exclusive');
      expect(flags['branch-alias']).to.have.property('exclusive');
      expect((flags['branch'] as any).exclusive).to.include('branch-alias');
      expect((flags['branch-alias'] as any).exclusive).to.include('branch');
    });
  });

  describe('module flag options', () => {
    it('should have options defined on the module flag', () => {
      const flags = ExportCommand.flags;

      expect(flags['module']).to.have.property('options');
      expect((flags['module'] as any).options).to.be.an('array').that.is.not.empty;
    });

    it('should accept all valid module names', () => {
      const validModules = [
        'stack',
        'assets',
        'locales',
        'environments',
        'extensions',
        'webhooks',
        'global-fields',
        'entries',
        'content-types',
        'custom-roles',
        'workflows',
        'publishing-rules',
        'labels',
        'marketplace-apps',
        'taxonomies',
        'personalize',
        'composable-studio',
      ];
      const moduleOptions = (ExportCommand.flags['module'] as any).options as string[];

      for (const mod of validModules) {
        expect(moduleOptions).to.include(mod, `module flag options should include '${mod}'`);
      }
    });

    it('should not accept invalid module names', () => {
      const moduleOptions = (ExportCommand.flags['module'] as any).options as string[];

      expect(moduleOptions).to.not.include('invalid-module');
      expect(moduleOptions).to.not.include('foo');
      expect(moduleOptions).to.not.include('');
    });

    it('should have the correct number of valid modules', () => {
      const moduleOptions = (ExportCommand.flags['module'] as any).options as string[];

      expect(moduleOptions).to.have.lengthOf(17);
    });
  });
});
