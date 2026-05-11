import { expect } from 'chai';
import sinon from 'sinon';

import ExportAssetTypes from '../../../src/export/asset-types';
import { AssetManagementExportAdapter } from '../../../src/export/base';

import type { AssetManagementAPIConfig } from '../../../src/types/asset-management-api';
import type { ExportContext } from '../../../src/types/export-types';

describe('ExportAssetTypes', () => {
  const apiConfig: AssetManagementAPIConfig = {
    baseURL: 'https://am.example.com',
    headers: { organization_uid: 'org-1' },
  };

  const exportContext: ExportContext = {
    spacesRootPath: '/tmp/export/spaces',
  };

  const spaceUid = 'space-uid-1';
  const assetTypesDir = '/tmp/export/spaces/asset_types';

  const assetTypesResponse = {
    count: 2,
    relation: 'organization',
    asset_types: [
      { uid: 'at1', title: 'Image', category: 'image', file_extension: 'png' },
      { uid: 'at2', title: 'Document', category: 'document', file_extension: 'pdf' },
    ],
  };

  beforeEach(() => {
    sinon.stub(AssetManagementExportAdapter.prototype, 'init' as any).resolves();
    sinon.stub(AssetManagementExportAdapter.prototype, 'writeItemsToChunkedJson' as any).resolves();
    sinon.stub(AssetManagementExportAdapter.prototype, 'tick' as any);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('start method', () => {
    it('should call getWorkspaceAssetTypes with the correct spaceUid', async () => {
      const getStub = sinon.stub(ExportAssetTypes.prototype, 'getWorkspaceAssetTypes').resolves(assetTypesResponse);
      const exporter = new ExportAssetTypes(apiConfig, exportContext);
      await exporter.start(spaceUid);

      expect(getStub.firstCall.args[0]).to.equal(spaceUid);
    });

    it('should write asset types with correct chunked JSON args', async () => {
      sinon.stub(ExportAssetTypes.prototype, 'getWorkspaceAssetTypes').resolves(assetTypesResponse);
      const exporter = new ExportAssetTypes(apiConfig, exportContext);
      await exporter.start(spaceUid);

      const writeStub = (AssetManagementExportAdapter.prototype as any).writeItemsToChunkedJson as sinon.SinonStub;
      const args = writeStub.firstCall.args;
      expect(args[0]).to.equal(assetTypesDir);
      expect(args[1]).to.equal('asset-types.json');
      expect(args[2]).to.equal('asset_types');
      expect(args[3]).to.deep.equal(['uid', 'title', 'category', 'file_extension']);
      expect(args[4]).to.deep.equal(assetTypesResponse.asset_types);
    });

    it('should write empty items when no asset types returned', async () => {
      sinon.stub(ExportAssetTypes.prototype, 'getWorkspaceAssetTypes').resolves({
        count: 0,
        relation: 'organization',
        asset_types: [],
      });
      const exporter = new ExportAssetTypes(apiConfig, exportContext);
      await exporter.start(spaceUid);

      const writeStub = (AssetManagementExportAdapter.prototype as any).writeItemsToChunkedJson as sinon.SinonStub;
      expect(writeStub.firstCall.args[4]).to.deep.equal([]);
    });

    it('should tick once with the asset_types summary label and null error after writing', async () => {
      sinon.stub(ExportAssetTypes.prototype, 'getWorkspaceAssetTypes').resolves(assetTypesResponse);
      const exporter = new ExportAssetTypes(apiConfig, exportContext);
      await exporter.start(spaceUid);

      const tickStub = (AssetManagementExportAdapter.prototype as any).tick as sinon.SinonStub;
      expect(tickStub.callCount).to.equal(1);
      const [success, label, error] = tickStub.firstCall.args;
      expect(success).to.be.true;
      // Label format is `asset_types (<count>)` so the shared row carries a count
      // summary; exact count comes from the mocked asset-types response.
      expect(String(label)).to.match(/^asset_types \(\d+\)$/);
      expect(error).to.be.null;
    });
  });
});
