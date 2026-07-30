import fs from 'fs';
import { resolve } from 'path';
import { expect } from 'chai';
import fancy from 'fancy-test';
import Sinon from 'sinon';
import config from '../../../src/config';
import { Assets } from '../../../src/modules';
import { ModuleConstructorParam, CtConstructorParam } from '../../../src/types';
import { mockLogger } from '../mock-logger';

describe('Assets module', () => {
  let constructorParam: ModuleConstructorParam & CtConstructorParam;

  beforeEach(() => {
    constructorParam = {
      moduleName: 'assets',
      ctSchema: [],
      gfSchema: [],
      config: Object.assign(config, { basePath: resolve(__dirname, '..', 'mock', 'contents'), flags: {} }),
    };

    Sinon.stub(require('@contentstack/cli-utilities'), 'log').value(mockLogger);
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('lookForReference method (scan status)', () => {
    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .it('flags assets with a non-clean scan status and leaves clean/no-status assets alone', async () => {
        const assetsInstance = new Assets(constructorParam);
        await assetsInstance.prerequisiteData();
        await assetsInstance.lookForReference();

        expect(Object.keys(assetsInstance.missingScanStatusAssets)).to.have.members([
          'blt-pending-asset',
          'blt-quarantined-asset',
        ]);
        expect(assetsInstance.missingScanStatusAssets['blt-pending-asset'][0]).to.deep.include({
          asset_uid: 'blt-pending-asset',
          scan_status: 'pending',
        });
        expect(assetsInstance.missingScanStatusAssets['blt-quarantined-asset'][0]).to.deep.include({
          asset_uid: 'blt-quarantined-asset',
          scan_status: 'quarantined',
        });
        expect(assetsInstance.missingScanStatusAssets).to.not.have.property('blt-clean-asset');
        expect(assetsInstance.missingScanStatusAssets).to.not.have.property('blt-no-status-asset');
      });

    fancy
      .stdout({ print: process.env.PRINT === 'true' || false })
      .stub(fs, 'writeFileSync', () => {})
      .it('removes non-clean assets from the written-back chunk when fix mode is on', async () => {
        const writeFileSyncStub = Sinon.spy(fs, 'writeFileSync');
        const assetsInstance = new Assets({
          ...constructorParam,
          fix: true,
          config: { ...constructorParam.config, flags: { yes: true } },
        });
        await assetsInstance.prerequisiteData();
        await assetsInstance.lookForReference();

        expect(writeFileSyncStub.called).to.be.true;
        const writtenContent = JSON.parse(writeFileSyncStub.firstCall.args[1] as string);
        expect(writtenContent).to.not.have.property('blt-pending-asset');
        expect(writtenContent).to.not.have.property('blt-quarantined-asset');
        expect(writtenContent).to.have.property('blt-clean-asset');
        expect(writtenContent).to.have.property('blt-no-status-asset');
      });
  });
});
