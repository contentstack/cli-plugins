import { resolve } from 'path';
import { expect } from 'chai';
import cloneDeep from 'lodash/cloneDeep';
import fancy from 'fancy-test';
import Sinon from 'sinon';
import config from '../../../src/config';
import { CustomRoles } from '../../../src/modules';
import { CtConstructorParam, ModuleConstructorParam } from '../../../src/types';
import { mockLogger } from '../mock-logger';

describe('Custom roles module', () => {
  let constructorParam: ModuleConstructorParam & Pick<CtConstructorParam, 'ctSchema'>;

  beforeEach(() => {
    constructorParam = {
      moduleName: 'custom-roles',
      config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
      ctSchema: cloneDeep(require('../mock/contents/content_types/schema.json')),
    };
    
    // Mock the logger for all tests
    Sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  describe('run method', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should have missingFieldsInCustomRoles length equals to 2', async () => {
        const customRoleInstance = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'test' },
        });
        await customRoleInstance.run();
        expect(customRoleInstance.missingFieldsInCustomRoles).length(2);
        expect(JSON.stringify(customRoleInstance.missingFieldsInCustomRoles)).includes('"branches":["main"]');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should call fixCustomRoleSchema', async () => {
        const logSpy = Sinon.stub(CustomRoles.prototype, 'fixCustomRoleSchema').resolves();
        const customRoleInstance = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'test' },
          fix: true,
        });
        await customRoleInstance.run();
        expect(logSpy.callCount).to.be.equals(1);
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('should call writeFixContent', async () => {
        const logSpy = Sinon.stub(CustomRoles.prototype, 'writeFixContent').resolves();
        const customRoleInstance = new CustomRoles({
          ...constructorParam,
          config: { ...constructorParam.config, branch: 'test' },
          fix: true,
        });
        await customRoleInstance.run();
        expect(logSpy.callCount).to.be.equals(1);
      });
  });

  afterEach(() => {
    Sinon.restore(); // Clears Sinon spies/stubs/mocks
  });
});
