import map from 'lodash/map';
import values from 'lodash/values';
import filter from 'lodash/filter';
import unionBy from 'lodash/unionBy';
import orderBy from 'lodash/orderBy';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';
import { existsSync } from 'node:fs';
import includes from 'lodash/includes';
import { resolve as pResolve, join } from 'node:path';
import { FsUtility, log, handleAndLogError, generateUid } from '@contentstack/cli-utilities';
import { ImportSpaces, type SpaceMapping } from '@contentstack/cli-asset-management';
import { PATH_CONSTANTS } from '../../constants';

import config from '../../config';
import { ModuleClassParams } from '../../types';
import {
  buildImportSpacesOptions,
  formatDate,
  fsUtil,
  PROCESS_NAMES,
  MODULE_CONTEXTS,
  MODULE_NAMES,
  PROCESS_STATUS,
} from '../../utils';
import BaseClass, { ApiOptions } from './base-class';

export default class ImportAssets extends BaseClass {
  private fs: FsUtility;
  private assetsPath: string;
  private mapperDirPath: string;
  private assetsRootPath: string;
  private assetUidMapperPath: string;
  private assetUrlMapperPath: string;
  private assetFolderUidMapperPath: string;
  public assetConfig = config.modules.assets;
  private environments: Record<string, any> = {};
  private assetsUidMap: Record<string, unknown> = {};
  private assetsUrlMap: Record<string, unknown> = {};
  private assetsFolderMap: Record<string, unknown> = {};
  private rootFolder: { uid: string; name: string; parent_uid: string; created_at: string };

  constructor({ importConfig, stackAPIClient }: ModuleClassParams) {
    super({ importConfig, stackAPIClient });
    this.importConfig.context.module = MODULE_CONTEXTS.ASSETS;
    this.currentModuleName = MODULE_NAMES[MODULE_CONTEXTS.ASSETS];

    this.assetsPath = join(this.importConfig.backupDir, PATH_CONSTANTS.CONTENT_DIRS.ASSETS);
    this.mapperDirPath = join(this.importConfig.backupDir, PATH_CONSTANTS.MAPPER, PATH_CONSTANTS.MAPPER_MODULES.ASSETS);
    this.assetUidMapperPath = join(this.mapperDirPath, PATH_CONSTANTS.FILES.UID_MAPPING);
    this.assetUrlMapperPath = join(this.mapperDirPath, PATH_CONSTANTS.FILES.URL_MAPPING);
    this.assetFolderUidMapperPath = join(this.mapperDirPath, PATH_CONSTANTS.FILES.FOLDER_MAPPING);
    this.assetsRootPath = join(this.importConfig.backupDir, this.assetConfig.dirName);
    this.fs = new FsUtility({ basePath: this.mapperDirPath });
    this.environments = this.fs.readFile(
      join(this.importConfig.backupDir, PATH_CONSTANTS.CONTENT_DIRS.ENVIRONMENTS, PATH_CONSTANTS.FILES.ENVIRONMENTS),
      true,
    ) as Record<string, unknown>;
  }

  /**
   * @method start
   * @returns {Promise<void>} Promise<any>
   */
  async start(): Promise<void> {
    try {
      log.debug('Starting assets import process...', this.importConfig.context);

      // CS Assets: csAssetsEnabled is set in the config handler when spaces/ + am_v2 are detected.
      if (this.importConfig.csAssetsEnabled) {
        if (!this.importConfig.csAssetsUrl) {
          log.info(
            'CS Assets export detected but csAssetsUrl is not configured in the region settings. Skipping CS Assets asset import.',
            this.importConfig.context,
          );
          return;
        }

        const progress = this.createNestedProgress(this.currentModuleName);
        let spaceMappings: SpaceMapping[] = [];

        // Resolve the existing default space in the target branch before building options.
        // This allows the source default space to be imported into the pre-existing target default
        // space instead of creating a new one.
        const branchUid = this.importConfig.branchName ?? 'main';
        let targetDefaultSpaceUid: string | undefined;
        let targetDefaultWorkspaceUid: string | undefined;
        try {
          const branchData = (await this.stack.branch(branchUid).fetch({ include_settings: true })) as Record<
            string,
            any
          >;
          const linkedWorkspaces = (branchData?.settings?.am_v2?.linked_workspaces ?? []) as Array<{
            uid: string;
            space_uid: string;
            is_default: boolean;
          }>;
          const defaultMatches = linkedWorkspaces.filter((w) => w.is_default === true);
          if (defaultMatches.length > 1) {
            log.warn(
              `Target branch "${branchUid}" has ${defaultMatches.length} workspaces with is_default=true; using the first.`,
              this.importConfig.context,
            );
          }
          if (defaultMatches.length > 0) {
            targetDefaultSpaceUid = defaultMatches[0].space_uid;
            targetDefaultWorkspaceUid = defaultMatches[0].uid;
            log.debug(
              `Target default space: ${targetDefaultSpaceUid} (workspace uid: ${targetDefaultWorkspaceUid})`,
              this.importConfig.context,
            );
          } else {
            log.debug(
              'Target branch has no default workspace; source default space will be created as new.',
              this.importConfig.context,
            );
          }
        } catch (e) {
          log.debug(
            `Could not fetch target branch linked_workspaces for default space detection: ${e}`,
            this.importConfig.context,
          );
        }

        try {
          const importer = new ImportSpaces(
            buildImportSpacesOptions(this.importConfig, this.importConfig.csAssetsUrl, {
              targetDefaultSpaceUid,
              targetDefaultWorkspaceUid,
            }),
          );
          importer.setParentProgressManager(progress);
          ({ spaceMappings } = await importer.start());
        } catch (error) {
          this.completeProgress(false, (error as Error)?.message ?? 'CS Assets asset import failed');
          throw error;
        }

        await this.linkImportedAmSpacesToBranch(spaceMappings);

        if (!this.importConfig.skipAssetsPublish) {
          await this.publishAmSpaces(spaceMappings);
        }

        this.completeProgressWithMessage();
        return;
      }
      // Legacy flow continues below

      // Step 1: Analyze import data
      const [foldersCount, assetsCount, versionedAssetsCount, publishableAssetsCount] = await this.withLoadingSpinner(
        'ASSETS: Analyzing import data...',
        () => this.analyzeImportData(),
      );

      // Step 2: Initialize progress tracking
      const progress = this.createNestedProgress(this.currentModuleName);
      this.initializeProgress(progress, {
        foldersCount,
        assetsCount,
        versionedAssetsCount,
        publishableAssetsCount,
      });

      // Step 3: Perform import steps based on data
      if (foldersCount > 0) {
        await this.executeStep(
          progress,
          PROCESS_NAMES.ASSET_FOLDERS,
          PROCESS_STATUS[PROCESS_NAMES.ASSET_FOLDERS].CREATING,
          () => this.importFolders(),
        );
      }

      if (this.assetConfig.includeVersionedAssets && versionedAssetsCount > 0) {
        await this.executeStep(
          progress,
          PROCESS_NAMES.ASSET_VERSIONS,
          PROCESS_STATUS[PROCESS_NAMES.ASSET_VERSIONS].IMPORTING,
          () => this.importAssets(true),
        );
      }

      if (assetsCount > 0) {
        await this.executeStep(
          progress,
          PROCESS_NAMES.ASSET_UPLOAD,
          PROCESS_STATUS[PROCESS_NAMES.ASSET_UPLOAD].UPLOADING,
          () => this.importAssets(),
        );
      }

      if (!this.importConfig.skipAssetsPublish && publishableAssetsCount > 0) {
        await this.executeStep(
          progress,
          PROCESS_NAMES.ASSET_PUBLISH,
          PROCESS_STATUS[PROCESS_NAMES.ASSET_PUBLISH].PUBLISHING,
          () => this.publish(),
        );
      }

      this.completeProgress(true);
      log.success('Assets imported successfully!', this.importConfig.context);
    } catch (error) {
      this.completeProgress(false, error?.message || 'Asset import failed');
      handleAndLogError(error, { ...this.importConfig.context });
    }
  }

  /**
   * Merges imported AM spaces into the target stack branch's `am_v2.linked_workspaces`.
   * Errors are logged and swallowed so a successful import still completes; import failures are handled separately.
   */
  private async linkImportedAmSpacesToBranch(spaceMappings: SpaceMapping[]): Promise<void> {
    if (spaceMappings.length === 0) {
      return;
    }

    try {
      const branchUid = this.importConfig.branchName ?? 'main';

      const branchData = (await this.stack.branch(branchUid).fetch({ include_settings: true })) as Record<string, any>;
      const currentLinked = (branchData?.settings?.am_v2?.linked_workspaces ?? []) as Array<{
        uid: string;
        space_uid: string;
        is_default: boolean;
        operation?: string;
      }>;

      // Skip spaces already linked to the branch (e.g. the pre-existing target default space).
      const alreadyLinkedSpaceUids = new Set(currentLinked.map((w) => w.space_uid));
      const newWorkspaces = spaceMappings
        .filter(({ newSpaceUid }) => !alreadyLinkedSpaceUids.has(newSpaceUid))
        .map(({ newSpaceUid, workspaceUid }) => ({
          uid: workspaceUid,
          space_uid: newSpaceUid,
          is_default: false,
          operation: 'LINK' as const,
        }));

      const combinedWorkspaces = [...currentLinked, ...newWorkspaces];

      await this.stack.branch(branchUid).updateSettings({
        branch: { settings: { am_v2: { linked_workspaces: combinedWorkspaces } } },
      });
      log.success(`Linked ${newWorkspaces.length} space(s) to branch "${branchUid}"`, this.importConfig.context);
    } catch (linkErr) {
      handleAndLogError(linkErr, {
        ...this.importConfig.context,
        phase: 'CS Assets branch linking (linked_workspaces)',
      });
    }
  }

  /**
   * Returns true when an AM asset will actually be published, so counting and enqueuing stay in sync
   * with the ticks emitted per publish attempt. Requires all three:
   *  - a UID mapping (old AM UID → new AM UID); without it the asset was never uploaded and cannot be
   *    published — counting it would leave the progress bar short a tick,
   *  - at least one publish_details entry for the source stack (matching api_key) — an AM asset is
   *    shared and may be published into multiple stacks; only this export's stack is replayed,
   *  - that entry targets an environment present in the source environments map (so we can map it).
   */
  private isAmAssetPublishable(asset: Record<string, any>, sourceStack: string): boolean {
    if (!asset?.uid || !this.assetsUidMap?.[asset.uid]) {
      return false;
    }
    return (
      filter(
        asset?.publish_details,
        (pd: any) => pd?.api_key === sourceStack && this.environments?.hasOwnProperty(pd?.environment),
      ).length > 0
    );
  }

  /**
   * Groups already-filtered `publish_details` into publish payloads that preserve the source
   * env↔locale pairing. Entries are grouped by environment, then environments sharing an
   * identical locale set are coalesced into one payload. Each returned group is a rectangle
   * (its environments × its locales), so the CMA env×locale cross-product reproduces exactly
   * the source pairs — never a phantom combination (the DX-9772 over-publish).
   *
   * A fully-rectangular input (every env published to the same locales) collapses to a single
   * group, so behavior is unchanged for the common case; a ragged input fans out into one group
   * per distinct locale set. Only environments present in `this.environments` are kept, so the
   * env-name lookup is always safe — this preserves the DX-1656 invalid-environment guard.
   * Callers apply any further scoping (e.g. AM's `api_key`) before calling.
   */
  private buildPublishGroups(
    publishDetails: Record<string, any>[],
  ): { environments: string[]; locales: string[] }[] {
    const localesByEnv = new Map<string, Set<string>>();
    for (const { environment, locale } of publishDetails || []) {
      if (!locale || !this.environments?.hasOwnProperty(environment)) continue;
      let set = localesByEnv.get(environment);
      if (!set) {
        set = new Set<string>();
        localesByEnv.set(environment, set);
      }
      set.add(locale);
    }

    // Coalesce environments with an identical locale set into a single payload.
    const groups = new Map<string, { environments: string[]; locales: string[] }>();
    for (const [envUid, localeSet] of localesByEnv) {
      const locales = [...localeSet].sort();
      const signature = locales.join(' ');
      const existing = groups.get(signature);
      if (existing) {
        existing.environments.push(this.environments[envUid].name);
      } else {
        groups.set(signature, { environments: [this.environments[envUid].name], locales });
      }
    }
    return [...groups.values()];
  }

  /**
   * Publishes imported AM (Contentstack Assets / spaces) assets, mirroring the legacy `publish()`
   * but re-pointed at each space's chunk store under `spaces/{oldSpaceUid}/assets`.
   *
   * Environments and asset UIDs are resolved from the same maps the legacy path uses:
   *  - `this.environments` (source env UID → { name }) loaded in the constructor,
   *  - `this.assetsUidMap` (old AM UID → new AM UID) from `mapper/assets/uid-mapping.json`, which the
   *    AM import already wrote.
   * Only publish_details for the source stack (`config.source_stack`) are honored — see
   * {@link isAmAssetPublishable}.
   *
   * @param {SpaceMapping[]} spaceMappings mappings produced by the AM import
   */
  private async publishAmSpaces(spaceMappings: SpaceMapping[]): Promise<void> {
    const sourceStack = this.importConfig.source_stack;
    if (!sourceStack) {
      log.warn(
        'Skipping CS Assets publish: source stack API key (stack/stack.json) not found, so publish_details cannot be scoped to this stack.',
        this.importConfig.context,
      );
      return;
    }

    if (isEmpty(this.assetsUidMap)) {
      log.debug('Loading asset UID mappings from file for CS Assets publish', this.importConfig.context);
      this.assetsUidMap = (this.fs.readFile(this.assetUidMapperPath, true) as Record<string, unknown>) || {};
    }

    const assetsFileName = this.assetConfig.fileName;

    // Resolve each space's on-disk assets dir (spaces/{oldSpaceUid}/assets), matching where the AM
    // import read from. Skip spaces without an assets index (empty/reused).
    const spaceAssetDirs = spaceMappings
      .map(({ oldSpaceUid }) => join(this.importConfig.contentDir, 'spaces', oldSpaceUid, 'assets'))
      .filter((dir) => existsSync(join(dir, assetsFileName)));

    if (spaceAssetDirs.length === 0) {
      // Imported spaces exist but none expose an assets index at the expected on-disk path. This is
      // usually a layout change in the AM export (a silently-skipped publish would look like success),
      // so surface it loudly rather than at debug.
      if (spaceMappings.length > 0) {
        log.warn(
          `CS Assets publish skipped: no assets index found under spaces/{spaceUid}/${assetsFileName} for ${spaceMappings.length} imported space(s). Assets were imported but not published.`,
          this.importConfig.context,
        );
      } else {
        log.debug('No CS Assets spaces to publish', this.importConfig.context);
      }
      return;
    }

    // Pass 1: count publishable assets (source-stack scoped) for the progress row total.
    let publishableCount = 0;
    for (const assetsDir of spaceAssetDirs) {
      const fsUtil = new FsUtility({ basePath: assetsDir, indexFileName: assetsFileName });
      for (const _ of values(fsUtil.indexFileContent)) {
        const chunkData = await fsUtil.readChunkFiles.next().catch(() => ({}));
        for (const asset of values(chunkData as Record<string, any>[])) {
          if (!this.isAmAssetPublishable(asset, sourceStack)) continue;
          // Count publish calls (one per env-locale-set group), not assets, so ticks stay 1:1.
          publishableCount += this.buildPublishGroups(
            filter(asset.publish_details, (pd: any) => pd?.api_key === sourceStack),
          ).length;
        }
      }
    }

    if (publishableCount === 0) {
      log.info('No CS Assets to publish for the source stack', this.importConfig.context);
      return;
    }

    this.progressManager?.addProcess(PROCESS_NAMES.ASSET_PUBLISH, publishableCount);
    this.progressManager
      ?.startProcess(PROCESS_NAMES.ASSET_PUBLISH)
      .updateStatus(PROCESS_STATUS[PROCESS_NAMES.ASSET_PUBLISH].PUBLISHING, PROCESS_NAMES.ASSET_PUBLISH);

    const onSuccess = ({ apiData: { uid, title } = undefined }: any) => {
      this.progressManager?.tick(true, `published: ${title || uid}`, null, PROCESS_NAMES.ASSET_PUBLISH);
      log.success(`Asset '${uid}: ${title}' published successfully`, this.importConfig.context);
    };

    const onReject = ({ error, apiData: { uid, title } = undefined }: any) => {
      this.progressManager?.tick(
        false,
        `publish failed: ${title || uid}`,
        error?.message || PROCESS_STATUS[PROCESS_NAMES.ASSET_PUBLISH].FAILED,
        PROCESS_NAMES.ASSET_PUBLISH,
      );
      log.error(`Asset '${uid}: ${title}' not published`, this.importConfig.context);
      handleAndLogError(error, { ...this.importConfig.context, uid, title });
    };

    // apiData is a pre-expanded sub-item ({ uid, title, publishDetails }); one per env-locale-set
    // group (see Pass 2). Pairing is already preserved, so this only resolves the destination UID.
    const serializeData = (apiOptions: ApiOptions) => {
      const { apiData } = apiOptions;
      apiOptions.uid = this.assetsUidMap[apiData.uid] as string;
      if (!apiOptions.uid) {
        log.debug(`Skipping publish for asset ${apiData.uid} - no UID mapping found`, this.importConfig.context);
        apiOptions.entity = undefined;
      }
      return apiOptions;
    };

    // Pass 2: publish, one space's chunks at a time. Only source-stack-scoped assets are enqueued so
    // every ticked item is a real publish attempt.
    for (const assetsDir of spaceAssetDirs) {
      const fsUtil = new FsUtility({ basePath: assetsDir, indexFileName: assetsFileName });
      const indexer = fsUtil.indexFileContent;
      const indexerCount = values(indexer).length;

      for (const index in indexer) {
        // Expand each publishable asset into one sub-item per env-locale-set group, so each
        // makeConcurrentCall item is a single-rectangle publish (preserves env↔locale pairing).
        const apiContent = values(await fsUtil.readChunkFiles.next()).flatMap((asset: Record<string, any>) => {
          if (!this.isAmAssetPublishable(asset, sourceStack)) return [];
          return this.buildPublishGroups(
            filter(asset.publish_details, (pd: any) => pd?.api_key === sourceStack),
          ).map((publishDetails) => ({ uid: asset.uid, title: asset.title, publishDetails }));
        });
        log.debug(`Found ${apiContent.length} CS Asset publish calls in chunk ${index}`, this.importConfig.context);

        await this.makeConcurrentCall({
          apiContent,
          indexerCount,
          currentIndexer: +index,
          processName: 'cs-assets publish',
          apiParams: {
            serializeData,
            reject: onReject,
            resolve: onSuccess,
            entity: 'publish-assets',
            includeParamOnCompletion: true,
          },
          concurrencyLimit: this.assetConfig.uploadAssetsConcurrency,
        });
      }
    }

    this.progressManager?.completeProcess(PROCESS_NAMES.ASSET_PUBLISH, true);
  }

  /**
   * @method importFolders
   * @returns {Promise<any>} Promise<any>
   */
  async importFolders(): Promise<any> {
    const foldersPath = pResolve(this.assetsRootPath, 'folders.json');
    log.debug(`Reading folders from: ${foldersPath}`, this.importConfig.context);

    const folders = this.fs.readFile(foldersPath);
    if (isEmpty(folders)) {
      log.info('No folders found to import', this.importConfig.context);
      return;
    }
    log.debug(`Found ${folders.length} folders to import`, this.importConfig.context);

    const batches = this.constructFolderImportOrder(folders);
    log.debug(`Organized folders into ${batches.length} batches for import`, this.importConfig.context);

    const onSuccess = ({ response, apiData: { uid, name } = { uid: null, name: '' } }: any) => {
      this.assetsFolderMap[uid] = response.uid;
      this.progressManager?.tick(true, `folder: ${name || uid}`, null, PROCESS_NAMES.ASSET_FOLDERS);
      log.debug(`Created folder: ${name} (Mapped ${uid} → ${response.uid})`, this.importConfig.context);
      log.success(`Created folder: '${name}'`, this.importConfig.context);
    };

    const onReject = ({ error, apiData: { name, uid } = { name: '', uid: '' } }: any) => {
      this.progressManager?.tick(
        false,
        `folder: ${name || uid}`,
        error?.message || PROCESS_STATUS[PROCESS_NAMES.ASSET_FOLDERS].FAILED,
        PROCESS_NAMES.ASSET_FOLDERS,
      );
      log.error(`${name} folder creation failed.!`, this.importConfig.context);
      handleAndLogError(error, { ...this.importConfig.context, name });
    };

    const serializeData = (apiOptions: ApiOptions) => {
      if (apiOptions.apiData.parent_uid) {
        const originalParent = apiOptions.apiData.parent_uid;
        apiOptions.apiData.parent_uid = this.assetsFolderMap[apiOptions.apiData.parent_uid];
        log.debug(
          `Mapped parent folder: ${originalParent} → ${apiOptions.apiData.parent_uid}`,
          this.importConfig.context,
        );
      }
      return apiOptions;
    };

    const batch = map(unionBy(batches, 'parent_uid'), 'parent_uid');
    log.debug(`Processing ${batch.length} folder batches`, this.importConfig.context);

    for (const parent_uid of batch) {
      const currentBatch = filter(batches, { parent_uid });
      log.debug(
        `Processing batch with parent_uid: ${parent_uid} (${currentBatch.length} folders)`,
        this.importConfig.context,
      );

      // NOTE create parent folders
      /* eslint-disable no-await-in-loop */
      await this.makeConcurrentCall(
        {
          apiContent: orderBy(currentBatch, 'created_at'),
          processName: 'import assets folders',
          apiParams: {
            serializeData,
            reject: onReject,
            resolve: onSuccess,
            entity: 'create-assets-folder',
            includeParamOnCompletion: true,
          },
          concurrencyLimit: this.assetConfig.importFoldersConcurrency,
        },
        undefined,
        false,
      );
    }

    if (!isEmpty(this.assetsFolderMap)) {
      log.debug(`Writing folder mappings to ${this.assetFolderUidMapperPath}`, this.importConfig.context);
      this.fs.writeFile(this.assetFolderUidMapperPath, this.assetsFolderMap);
    }
  }

  /**
   * @method importAssets
   * @param {boolean} isVersion boolean
   * @returns {Promise<void>} Promise<void>
   */
  async importAssets(isVersion = false): Promise<void> {
    const processName = isVersion ? 'import versioned assets' : 'import assets';
    const indexFileName = isVersion ? PATH_CONSTANTS.FILES.VERSIONED_ASSETS : this.assetConfig.fileName;
    const basePath = isVersion ? join(this.assetsPath, 'versions') : this.assetsPath;
    const progressProcessName = isVersion ? PROCESS_NAMES.ASSET_VERSIONS : PROCESS_NAMES.ASSET_UPLOAD;

    log.debug(`Importing ${processName} from ${basePath}`, this.importConfig.context);

    const fs = new FsUtility({ basePath, indexFileName });
    const indexer = fs.indexFileContent;
    const indexerCount = values(indexer).length;

    log.debug(`Found ${indexerCount} asset chunks to process`, this.importConfig.context);

    const onSuccess = ({ response = {}, apiData: { uid, url, title } = undefined }: any) => {
      this.assetsUidMap[uid] = response.uid;
      this.assetsUrlMap[url] = response.url;
      this.progressManager?.tick(true, `asset: ${title || uid}`, null, progressProcessName);
      log.debug(`Created asset: ${title} (Mapped ${uid} → ${response.uid})`, this.importConfig.context);
      log.success(`Created asset: '${title}'`, this.importConfig.context);
    };

    const onReject = ({ error, apiData: { title, uid } = undefined }: any) => {
      this.progressManager?.tick(
        false,
        `asset: ${title || uid}`,
        error?.message || PROCESS_STATUS[PROCESS_NAMES.ASSET_UPLOAD].FAILED,
        progressProcessName,
      );
      log.error(`${title} asset upload failed.!`, this.importConfig.context);
      handleAndLogError(error, { ...this.importConfig.context, title });
    };

    /* eslint-disable @typescript-eslint/no-unused-vars, guard-for-in */
    for (const index in indexer) {
      log.debug(`Processing chunk ${index} of ${indexerCount}`, this.importConfig.context);

      const chunk = await fs.readChunkFiles.next().catch((error) => {
        handleAndLogError(error, { ...this.importConfig.context });
      });

      if (chunk) {
        let apiContent = orderBy(values(chunk as Record<string, any>[]), '_version');
        log.debug(`Processing ${apiContent.length} assets in chunk`, this.importConfig.context);

        if (isVersion && this.assetConfig.importSameStructure) {
          log.debug('Processing version 1 assets first', this.importConfig.context);
          const versionOneAssets = filter(apiContent, ({ _version }) => _version === 1);

          await this.makeConcurrentCall({
            processName,
            indexerCount,
            currentIndexer: +index,
            apiContent: versionOneAssets,
            apiParams: {
              reject: onReject,
              resolve: onSuccess,
              entity: 'create-assets',
              includeParamOnCompletion: true,
              serializeData: this.serializeAssets.bind(this),
            },
            concurrencyLimit: this.assetConfig.uploadAssetsConcurrency,
          });

          apiContent = filter(apiContent, ({ _version }) => _version > 1);
          log.debug(`Processing ${apiContent.length} versioned assets after version 1`, this.importConfig.context);
        }

        await this.makeConcurrentCall(
          {
            apiContent,
            processName,
            indexerCount,
            currentIndexer: +index,
            apiParams: {
              reject: onReject,
              resolve: onSuccess,
              entity: 'create-assets',
              includeParamOnCompletion: true,
              serializeData: this.serializeAssets.bind(this),
            },
            concurrencyLimit: this.assetConfig.uploadAssetsConcurrency,
          },
          undefined,
          !isVersion,
        );
      }
    }

    if (!isVersion) {
      if (!isEmpty(this.assetsUidMap)) {
        const uidMappingCount = Object.keys(this.assetsUidMap || {}).length;
        log.debug(`Writing ${uidMappingCount} UID mappings`, this.importConfig.context);
        this.fs.writeFile(this.assetUidMapperPath, this.assetsUidMap);
      }
      if (!isEmpty(this.assetsUrlMap)) {
        const urlMappingCount = Object.keys(this.assetsUrlMap || {}).length;
        log.debug(`Writing ${urlMappingCount} URL mappings`, this.importConfig.context);
        this.fs.writeFile(this.assetUrlMapperPath, this.assetsUrlMap);
      }
    }
  }

  /**
   * @method serializeAssets
   * @param {ApiOptions} apiOptions ApiOptions
   * @returns {ApiOptions} ApiOptions
   */
  serializeAssets(apiOptions: ApiOptions): ApiOptions {
    const { apiData: asset } = apiOptions;

    if (
      !this.assetConfig.importSameStructure &&
      !this.assetConfig.includeVersionedAssets &&
      this.assetsUidMap.hasOwnProperty(asset.uid)
    ) {
      log.info(`Skipping existing asset: ${asset.uid} (${asset.title})`, this.importConfig.context);
      apiOptions.entity = undefined;
      return apiOptions;
    }

    asset.upload = join(this.assetsPath, 'files', asset.uid, asset.filename);
    log.debug(`Asset file path resolved to: ${asset.upload}`, this.importConfig.context);

    if (asset.parent_uid) {
      const originalParent = asset.parent_uid;
      asset.parent_uid = this.assetsFolderMap[asset.parent_uid];
      log.debug(`Mapped parent UID: ${originalParent} → ${asset.parent_uid}`, this.importConfig.context);
    } else if (this.importConfig.replaceExisting) {
      asset.parent_uid = this.assetsFolderMap[this.rootFolder.uid];
      log.debug(`Assigned root folder as parent: ${asset.parent_uid}`, this.importConfig.context);
    }

    apiOptions.apiData = asset;

    if (this.assetsUidMap[asset.uid] && this.assetConfig.importSameStructure) {
      apiOptions.entity = 'replace-assets';
      apiOptions.uid = this.assetsUidMap[asset.uid] as string;
      log.debug(`Preparing to replace asset: ${asset.uid} → ${apiOptions.uid}`, this.importConfig.context);
    }

    return apiOptions;
  }

  /**
   * @method publish
   * @returns {Promise<void>} Promise<void>
   */
  async publish() {
    const fs = new FsUtility({
      basePath: this.assetsPath,
      indexFileName: this.assetConfig.fileName,
    });
    if (isEmpty(this.assetsUidMap)) {
      log.debug('Loading asset UID mappings from file', this.importConfig.context);
      this.assetsUidMap = fs.readFile(this.assetUidMapperPath, true) as any;
    }

    const indexer = fs.indexFileContent;
    const indexerCount = values(indexer).length;
    log.debug(`Found ${indexerCount} asset chunks to publish`, this.importConfig.context);

    const onSuccess = ({ apiData: { uid, title } = undefined }: any) => {
      this.progressManager?.tick(true, `published: ${title || uid}`, null, PROCESS_NAMES.ASSET_PUBLISH);
      log.success(`Asset '${uid}: ${title}' published successfully`, this.importConfig.context);
    };

    const onReject = ({ error, apiData: { uid, title } = undefined }: any) => {
      this.progressManager?.tick(
        false,
        `publish failed: ${title || uid}`,
        error?.message || PROCESS_STATUS[PROCESS_NAMES.ASSET_PUBLISH].FAILED,
        PROCESS_NAMES.ASSET_PUBLISH,
      );
      log.error(`Asset '${uid}: ${title}' not published`, this.importConfig.context);
      handleAndLogError(error, { ...this.importConfig.context, uid, title });
    };

    const serializeData = (apiOptions: ApiOptions) => {
      const { apiData: asset } = apiOptions;
      const publishDetails = filter(asset.publish_details, ({ environment }) => {
        return this.environments?.hasOwnProperty(environment);
      });

      if (publishDetails.length) {
        const environments = uniq(map(publishDetails, ({ environment }) => this.environments[environment].name));
        const locales = uniq(map(publishDetails, 'locale'));

        if (environments.length === 0 || locales.length === 0) {
          log.debug(
            `Skipping publish for asset ${asset.uid} - no valid environments/locales`,
            this.importConfig.context,
          );
          apiOptions.entity = undefined;
          return apiOptions;
        }

        asset.locales = locales;
        asset.environments = environments;
        apiOptions.apiData.publishDetails = { locales, environments };
        log.debug(`Prepared publish details for asset ${asset.uid}`, this.importConfig.context);
      }

      apiOptions.uid = this.assetsUidMap[asset.uid] as string;

      if (!apiOptions.uid) {
        log.debug(`Skipping publish for asset ${asset.uid} - no UID mapping found`, this.importConfig.context);
        apiOptions.entity = undefined;
      }

      return apiOptions;
    };

    for (const index in indexer) {
      log.debug(`Processing publish chunk ${index} of ${indexerCount}`, this.importConfig.context);
      const apiContent = filter(
        values(await fs.readChunkFiles.next()),
        ({ publish_details }) => !isEmpty(publish_details),
      );

      log.debug(`Found ${apiContent.length} publishable assets in chunk`, this.importConfig.context);

      await this.makeConcurrentCall({
        apiContent,
        indexerCount,
        currentIndexer: +index,
        processName: 'assets publish',
        apiParams: {
          serializeData,
          reject: onReject,
          resolve: onSuccess,
          entity: 'publish-assets',
          includeParamOnCompletion: true,
        },
        concurrencyLimit: this.assetConfig.uploadAssetsConcurrency,
      });
    }
  }

  /**
   * @method constructFolderImportOrder
   * @param {Record<string, any>[]} folders object
   * @returns {Array<Record<string, any>>} Array<Record<string, any>>
   */
  constructFolderImportOrder(folders: any): Array<Record<string, any>> {
    let parentUIds: unknown[] = [];
    const importOrder = filter(folders, { parent_uid: null }).map(({ uid, name, parent_uid, created_at }) => {
      parentUIds.push(uid);
      return { uid, name, parent_uid, created_at };
    });

    log.debug(`Found ${importOrder.length} root folders`, this.importConfig.context);

    while (!isEmpty(parentUIds)) {
      // NOTE: Read nested folders every iteration until we find empty folders
      const nestedFolders = filter(folders, ({ parent_uid }) => includes(parentUIds, parent_uid));
      log.debug(`Processing ${nestedFolders.length} nested folders`, this.importConfig.context);

      parentUIds = nestedFolders.map(({ uid, name, parent_uid, created_at }) => {
        importOrder.push({ uid, name, parent_uid, created_at });
        return uid;
      });
    }

    if (this.importConfig.replaceExisting) {
      log.debug('Setting up root folder for import', this.importConfig.context);
      // Note: adds a root folder to distinguish latest asset uploads
      // Todo: This temporary approach should be updated with asset and folder overwrite strategy, which follows
      // folder overwrite
      // 1. Create folder trees, 2. Export all target stack folders, 3.Match the source to target folders and create a list of existing folders
      // 4. Replace existing folders
      // Asset overwrite
      // 1. Search asset with title + filename + type
      // 2. if there are multiple assets fetched with same query, then check the parent uid against mapper created while importing folders
      // 3. Replace matched assets
      this.rootFolder = {
        uid: generateUid(),
        name: `Import-${formatDate()}`,
        parent_uid: null,
        created_at: null,
      };

      filter(importOrder, (folder, index) => {
        if (!folder.parent_uid) {
          importOrder.splice(index, 1, { ...folder, parent_uid: this.rootFolder.uid });
        }
      });

      importOrder.unshift(this.rootFolder);
      log.debug('Added root folder to import order', this.importConfig.context);
    }
    return importOrder;
  }

  private async analyzeImportData(): Promise<[number, number, number, number]> {
    const foldersCount = this.countFolders();
    const assetsCount = await this.countAssets(this.assetsPath, 'assets.json');

    let versionedAssetsCount = 0;
    if (this.assetConfig.includeVersionedAssets && existsSync(`${this.assetsPath}/versions`)) {
      versionedAssetsCount = await this.countAssets(`${this.assetsPath}/versions`, 'versioned-assets.json');
    }

    let publishableAssetsCount = 0;
    if (!this.importConfig.skipAssetsPublish) {
      publishableAssetsCount = await this.countPublishableAssets();
    }

    log.debug(
      `Analysis complete: ${foldersCount} folders, ${assetsCount} assets, ${versionedAssetsCount} versioned, ${publishableAssetsCount} publishable`,
      this.importConfig.context,
    );

    return [foldersCount, assetsCount, versionedAssetsCount, publishableAssetsCount];
  }

  private initializeProgress(
    progress: any,
    counts: {
      foldersCount: number;
      assetsCount: number;
      versionedAssetsCount: number;
      publishableAssetsCount: number;
    },
  ) {
    const { foldersCount, assetsCount, versionedAssetsCount, publishableAssetsCount } = counts;

    if (foldersCount > 0) {
      progress.addProcess(PROCESS_NAMES.ASSET_FOLDERS, foldersCount);
    }
    if (versionedAssetsCount > 0) {
      progress.addProcess(PROCESS_NAMES.ASSET_VERSIONS, versionedAssetsCount);
    }
    if (assetsCount > 0) {
      progress.addProcess(PROCESS_NAMES.ASSET_UPLOAD, assetsCount);
    }
    if (publishableAssetsCount > 0) {
      progress.addProcess(PROCESS_NAMES.ASSET_PUBLISH, publishableAssetsCount);
    }
  }

  private countFolders(): number {
    const foldersPath = pResolve(this.assetsRootPath, 'folders.json');
    const folders = this.fs.readFile(foldersPath) || [];
    return Array.isArray(folders) ? folders.length : 0;
  }

  private async countAssets(basePath: string, indexFileName: string): Promise<number> {
    const fsUtil = new FsUtility({ basePath, indexFileName });
    let count = 0;

    for (const _ of values(fsUtil.indexFileContent)) {
      const chunkData = await fsUtil.readChunkFiles.next().catch(() => ({}));
      count += values(chunkData as Record<string, any>[]).length;
    }

    return count;
  }

  private async countPublishableAssets(): Promise<number> {
    const fsUtil = new FsUtility({
      basePath: this.assetsPath,
      indexFileName: this.assetConfig.fileName,
    });
    let count = 0;

    for (const _ of values(fsUtil.indexFileContent)) {
      const chunkData = await fsUtil.readChunkFiles.next().catch(() => ({}));
      const publishableAssets = filter(
        values(chunkData as Record<string, any>[]),
        ({ publish_details }) => !isEmpty(publish_details),
      );
      count += publishableAssets.length;
    }

    return count;
  }

  private async executeStep(progress: any, name: string, status: string, action: () => Promise<void>): Promise<void> {
    progress.startProcess(name).updateStatus(status, name);
    log.debug(`Starting ${name.toLowerCase()}`, this.importConfig.context);
    await action();
    progress.completeProcess(name, true);
  }
}
