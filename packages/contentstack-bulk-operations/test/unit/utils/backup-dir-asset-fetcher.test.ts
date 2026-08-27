import sinon from 'sinon';
import * as path from 'path';
import { expect } from 'chai';
import { assetPublishTargets, scanBackupDirStats } from '../../../src/utils/backup-dir-asset-fetcher';
import { TargetBatcher } from '../../../src/utils/batch-helper';
import { AssetPublishData, BatchedItems } from '../../../src/interfaces';

const ENVIRONMENTS_MAP = { envDev: 'dev', envProd: 'prod', envStage: 'staging' };

/** Asset shaped the way an import backup stores it: publish_details reference environment UIDs. */
const devOnlyAsset = {
  uid: 'a1',
  _version: 2,
  publish_details: [{ environment: 'envDev', locale: 'en-us' }],
};

const prodOnlyAsset = {
  uid: 'a2',
  _version: 5,
  publish_details: [{ environment: 'envProd', locale: 'en-us' }],
};

describe('backup-dir asset fetcher', () => {
  describe('assetPublishTargets', () => {
    it('should map environment uids to names and keep them per locale', () => {
      const targets = assetPublishTargets(devOnlyAsset, ENVIRONMENTS_MAP);

      expect([...targets.keys()]).to.deep.equal(['en-us']);
      expect(targets.get('en-us')).to.deep.equal(['dev']);
    });

    it('should give each locale only the environments that locale was published to', () => {
      const asset = {
        uid: 'a3',
        _version: 1,
        publish_details: [
          { environment: 'envDev', locale: 'en-us' },
          { environment: 'envStage', locale: 'en-us' },
          { environment: 'envProd', locale: 'fr-fr' },
        ],
      };

      const targets = assetPublishTargets(asset, ENVIRONMENTS_MAP);

      expect(targets.get('en-us')).to.deep.equal(['dev', 'staging']);
      expect(targets.get('fr-fr')).to.deep.equal(['prod']);
    });

    it('should fall back to the raw environment value when the uid is not in the map', () => {
      const asset = { uid: 'a4', _version: 1, publish_details: [{ environment: 'unmapped-env', locale: 'en-us' }] };

      expect(assetPublishTargets(asset, ENVIRONMENTS_MAP).get('en-us')).to.deep.equal(['unmapped-env']);
    });

    it('should skip publish_details without a locale or environment', () => {
      const asset = {
        uid: 'a5',
        _version: 1,
        publish_details: [{ environment: 'envDev' }, { locale: 'en-us' }],
      };

      expect(assetPublishTargets(asset, ENVIRONMENTS_MAP).size).to.equal(0);
    });
  });

  // The composition streamAndPublish runs: an asset must reach only its own environments,
  // never the union across the backup.
  describe('per-asset targets through TargetBatcher', () => {
    it('should never publish an asset to another asset environments', () => {
      const emitted: Array<Omit<BatchedItems, 'totalBatches'>> = [];
      const batcher = new TargetBatcher((batch) => emitted.push(batch));

      for (const asset of [devOnlyAsset, prodOnlyAsset]) {
        const targets = assetPublishTargets(asset, ENVIRONMENTS_MAP);
        for (const [locale, environments] of targets) {
          batcher.add({
            type: 'asset',
            uid: `new-${asset.uid}`,
            locale,
            version: asset._version,
            publish_details: environments.map((environment) => ({ environment, locale })),
          } as AssetPublishData);
        }
      }
      batcher.end();

      expect(emitted).to.have.lengthOf(2);

      const devBatch = emitted.find((b) => b.items[0].uid === 'new-a1');
      const prodBatch = emitted.find((b) => b.items[0].uid === 'new-a2');

      expect(devBatch?.environments).to.deep.equal(['dev']);
      expect(devBatch?.locales).to.deep.equal(['en-us']);
      expect(prodBatch?.environments).to.deep.equal(['prod']);
      expect(prodBatch?.locales).to.deep.equal(['en-us']);
    });
  });

  describe('scanBackupDirStats', () => {
    // The suite's init helper no-ops fs.writeFileSync outside its allowlist, so reads are
    // stubbed rather than writing a real backup to disk.
    const backupDir = '/backup';
    const paths = {
      index: path.join(backupDir, 'assets', 'assets.json'),
      chunk: path.join(backupDir, 'assets', 'assets-1.json'),
      environments: path.join(backupDir, 'environments', 'environments.json'),
      mapper: path.join(backupDir, 'mapper', 'assets', 'uid-mapping.json'),
    };

    let files: Record<string, unknown>;

    beforeEach(() => {
      files = {
        [paths.index]: { '1': 'assets-1.json' },
        [paths.chunk]: {
          a1: devOnlyAsset,
          a2: prodOnlyAsset,
          a3: { uid: 'a3', _version: 1, publish_details: [] }, // skipped: never published
          a4: { uid: 'a4', _version: 1, publish_details: [{ environment: 'envDev', locale: 'en-us' }] }, // unmapped
        },
        [paths.environments]: { envDev: { name: 'dev' }, envProd: { name: 'prod' } },
        [paths.mapper]: { a1: 'new-a1', a2: 'new-a2' },
      };

      // require('fs') — the CJS binding is mutable; the ESM namespace import is not stubbable.
      const fs = require('fs');
      sinon.stub(fs, 'existsSync').callsFake((p: any) => Object.prototype.hasOwnProperty.call(files, String(p)));
      sinon.stub(fs, 'readFileSync').callsFake((p: any) => JSON.stringify(files[String(p)]));
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should count eligible, skipped and unmapped assets', async () => {
      const stats = await scanBackupDirStats(backupDir);

      expect(stats.eligible).to.equal(2);
      expect(stats.skipped).to.equal(1);
      expect(stats.unmapped).to.equal(1);
      expect(stats.totalItems).to.equal(2);
    });

    it('should return the environment uid to name map for pass 2', async () => {
      const stats = await scanBackupDirStats(backupDir);

      expect(stats.environmentsMap).to.deep.equal({ envDev: 'dev', envProd: 'prod' });
    });

    it('should report the backup wide unions for display only', async () => {
      const stats = await scanBackupDirStats(backupDir);

      // Correct as a summary of the backup — it is what must NOT reach the payload.
      expect(stats.environments).to.have.members(['dev', 'prod']);
      expect(stats.locales).to.deep.equal(['en-us']);
    });

    it('should count one batch per distinct target rather than per item chunk', async () => {
      const stats = await scanBackupDirStats(backupDir);

      // Two assets, two different single-environment targets -> two batches, not one.
      expect(stats.totalBatches).to.equal(2);
    });

    it('should throw when the asset index is missing', async () => {
      delete files[paths.index];

      try {
        await scanBackupDirStats(backupDir);
        expect.fail('expected scanBackupDirStats to throw');
      } catch (error: any) {
        expect(error.message).to.contain('Asset index not found');
      }
    });
  });
});
