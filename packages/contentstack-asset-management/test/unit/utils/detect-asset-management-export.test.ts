import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { stub, restore } from 'sinon';
import * as utilities from '@contentstack/cli-utilities';

import { detectAssetManagementExportFromContentDir } from '../../../src/utils/detect-asset-management-export';

describe('detectAssetManagementExportFromContentDir', () => {
  const tmpRoot = path.join(os.tmpdir(), `am-detect-test-${Date.now()}`);

  afterEach(() => {
    restore();
    if (fs.existsSync(tmpRoot)) {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('returns disabled when spaces directory is missing', () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'stack'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'stack', 'settings.json'), JSON.stringify({ am_v2: true }));

    const flags = detectAssetManagementExportFromContentDir(tmpRoot);
    expect(flags.assetManagementEnabled).to.equal(false);
  });

  it('returns disabled when stack settings are missing', () => {
    fs.mkdirSync(path.join(tmpRoot, 'spaces'), { recursive: true });

    const flags = detectAssetManagementExportFromContentDir(tmpRoot);
    expect(flags.assetManagementEnabled).to.equal(false);
  });

  it('returns disabled when linked asset management is not set in stack settings', () => {
    fs.mkdirSync(path.join(tmpRoot, 'spaces'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'stack'), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, 'stack', 'settings.json'), JSON.stringify({ other: true }));

    const flags = detectAssetManagementExportFromContentDir(tmpRoot);
    expect(flags.assetManagementEnabled).to.equal(false);
  });

  it('enables asset management export and reads region URL and branches source stack when layout matches', () => {
    fs.mkdirSync(path.join(tmpRoot, 'spaces'), { recursive: true });
    fs.mkdirSync(path.join(tmpRoot, 'stack'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpRoot, 'stack', 'settings.json'),
      JSON.stringify({ am_v2: { linked_workspaces: [] } }),
    );
    fs.writeFileSync(
      path.join(tmpRoot, 'branches.json'),
      JSON.stringify([{ stackHeaders: { api_key: 'source-stack-key' } }]),
    );

    stub(utilities.configHandler, 'get').withArgs('region').returns({
      assetManagementUrl: 'https://am.example.com',
    });

    const flags = detectAssetManagementExportFromContentDir(tmpRoot);
    expect(flags.assetManagementEnabled).to.equal(true);
    expect(flags.assetManagementUrl).to.equal('https://am.example.com');
    expect(flags.source_stack).to.equal('source-stack-key');
  });
});
