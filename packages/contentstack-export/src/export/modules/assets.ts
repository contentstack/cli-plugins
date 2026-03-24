import {
  FsUtility,
  configHandler,
  getDirectories,
  handleAndLogError,
  log,
  messageHandler,
} from '@contentstack/cli-utilities';
import chunk from 'lodash/chunk';
import entries from 'lodash/entries';
import filter from 'lodash/filter';
import first from 'lodash/first';
import includes from 'lodash/includes';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';
import merge from 'lodash/merge';
import uniqBy from 'lodash/uniqBy';
import values from 'lodash/values';
import { createWriteStream } from 'node:fs';
import { resolve as pResolve } from 'node:path';
import progress from 'progress-stream';

import config from '../../config';
import { ModuleClassParams } from '../../types';
import BaseClass, { CustomPromiseHandler, CustomPromiseHandlerInput } from './base-class';

export default class ExportAssets extends BaseClass {
  public assetConfig = config.modules.assets;
  public versionedAssets: Record<string, unknown>[] = [];
  private assetsFolder: Record<string, unknown>[] = [];
  private assetsRootPath: string;

  constructor({ exportConfig, stackAPIClient }: ModuleClassParams) {
    super({ exportConfig, stackAPIClient });
    this.exportConfig.context.module = 'assets';
  }

  get commonQueryParam(): Record<string, unknown> {
    return {
      asc: 'created_at',
      include_count: false,
      skip: 0,
    };
  }

  /**
   * @method downloadAssets
   * @returns Promise<any|void>
   */
  async downloadAssets(): Promise<any | void> {
    const fs: FsUtility = new FsUtility({
      basePath: this.assetsRootPath,
      createDirIfNotExist: false,
      fileExt: 'json',
    });

    log.debug('Reading asset metadata for download...', this.exportConfig.context);
    const assetsMetaData = fs.getPlainMeta();

    let listOfAssets = values(assetsMetaData).flat();

    if (this.assetConfig.includeVersionedAssets) {
      const versionedAssetsMetaData = fs.getPlainMeta(pResolve(this.assetsRootPath, 'versions', 'metadata.json'));
      listOfAssets.push(...values(versionedAssetsMetaData).flat());
    }

    listOfAssets = uniqBy(listOfAssets, 'url');
    log.debug(`Total unique assets to download: ${listOfAssets.length}`, this.exportConfig.context);

    const apiBatches: Array<any> = chunk(listOfAssets, this.assetConfig.downloadLimit);
    const downloadedAssetsDirs = await getDirectories(pResolve(this.assetsRootPath, 'files'));

    const onSuccess = ({ additionalInfo, response: { data } }: any) => {
      const { asset } = additionalInfo;
      const assetFolderPath = pResolve(this.assetsRootPath, 'files', asset.uid);
      const assetFilePath = pResolve(assetFolderPath, asset.filename);

      log.debug(`Saving asset to: ${assetFilePath}`, this.exportConfig.context);

      if (!includes(downloadedAssetsDirs, asset.uid)) {
        fs.createFolderIfNotExist(assetFolderPath);
      }

      const assetWriterStream = createWriteStream(assetFilePath);
      assetWriterStream.on('error', (error) => {
        handleAndLogError(
          error,
          { ...this.exportConfig.context, filename: asset.fileName, uid: asset.uid },
          messageHandler.parse('ASSET_DOWNLOAD_FAILED', asset.filename, asset.uid),
        );
      });
      /**
       * NOTE if pipe not working as expected add the following code below to fix the issue
       * https://oramind.com/using-streams-efficiently-in-nodejs/
       * import * as stream from "stream";
       * import { promisify } from "util";
       * const finished = promisify(stream.finished);
       * await finished(assetWriterStream);
       */
      if (this.assetConfig.enableDownloadStatus) {
        const str = progress({
          length: data.headers['content-length'],
          time: 5000,
        });
        str.on('progress', function (progressData) {
          console.log(`${asset.filename}: ${Math.round(progressData.percentage)}%`);
        });
        data.pipe(str).pipe(assetWriterStream);
      } else {
        data.pipe(assetWriterStream);
      }

      log.success(messageHandler.parse('ASSET_DOWNLOAD_SUCCESS', asset.filename, asset.uid), this.exportConfig.context);
    };

    const onReject = ({ additionalInfo, error }: any) => {
      const { asset } = additionalInfo;
      handleAndLogError(
        error,
        { ...this.exportConfig.context, filename: asset.filename, uid: asset.uid },
        messageHandler.parse('ASSET_DOWNLOAD_FAILED', asset.filename, asset.uid),
      );
    };

    const promisifyHandler: CustomPromiseHandler = (input: CustomPromiseHandlerInput) => {
      const { batchIndex, index } = input;
      const asset: any = apiBatches[batchIndex][index];
      const url = this.assetConfig.securedAssets
        ? `${asset.url}?authtoken=${configHandler.get('authtoken')}`
        : asset.url;
      log.debug(
        `Preparing to download asset: ${asset.filename} (UID: ${asset.uid}) from URL: ${url}`,
        this.exportConfig.context,
      );
      return this.makeAPICall({
        additionalInfo: { asset },
        module: 'download-asset',
        reject: onReject,
        resolve: onSuccess,
        url: encodeURI(url),
      });
    };

    return this.makeConcurrentCall(
      {
        apiBatches,
        concurrencyLimit: this.assetConfig.downloadLimit,
        module: 'assets download',
        totalCount: listOfAssets.length,
      },
      promisifyHandler,
    ).then(() => {
      log.success(messageHandler.parse('ASSET_DOWNLOAD_COMPLETE'), this.exportConfig.context);
    });
  }

  /**
   * @method getAssets
   * @param totalCount number
   * @returns Promise<void>
   */
  getAssets(totalCount: number | void): Promise<any | void> {
    if (!totalCount) return Promise.resolve();

    log.debug(`Fetching ${totalCount} assets...`, this.exportConfig.context);

    let fs: FsUtility;
    let metaHandler: ((array: any) => any) | undefined;

    const queryParam = {
      ...this.commonQueryParam,
      except: { BASE: this.assetConfig.invalidKeys },
      include_publish_details: true,
    };
    this.applyQueryFilters(queryParam, 'assets');

    if (this.assetConfig.includeVersionedAssets) {
      const customHandler = (array: Array<any>) => {
        const versionAssets: Array<any> = filter(array, ({ _version }: any) => _version > 1);
        log.debug(`Found ${versionAssets.length} versioned assets`, this.exportConfig.context);
        if (!isEmpty(versionAssets)) {
          this.versionedAssets.push(
            ...map(versionAssets, ({ _version, uid }: any) => ({
              [uid]: _version,
            })),
          );
        }
      };
      metaHandler = customHandler;
    }

    const onReject = ({ error }: any) => {
      handleAndLogError(error, { ...this.exportConfig.context }, messageHandler.parse('ASSET_QUERY_FAILED'));
    };

    const onSuccess = ({ response: { items } }: any) => {
      log.debug(`Fetched ${items?.length || 0} assets`, this.exportConfig.context);
      if (!fs && !isEmpty(items)) {
        log.debug('Initializing FsUtility for writing assets metadata', this.exportConfig.context);
        fs = new FsUtility({
          basePath: this.assetsRootPath,
          chunkFileSize: this.assetConfig.chunkFileSize,
          indexFileName: 'assets.json',
          metaHandler,
          metaPickKeys: merge(['uid', 'url', 'filename', 'parent_uid'], this.assetConfig.assetsMetaKeys),
          moduleName: 'assets',
        });
      }
      if (!isEmpty(items)) {
        log.debug(`Writing ${items.length} assets into file`, this.exportConfig.context);
        fs?.writeIntoFile(items, { mapKeyVal: true });
      }
    };

    return this.makeConcurrentCall({
      apiParams: {
        module: 'assets',
        queryParam,
        reject: onReject,
        resolve: onSuccess,
      },
      concurrencyLimit: this.assetConfig.fetchConcurrency,
      module: 'assets',
      totalCount,
    }).then(() => {
      fs?.completeFile(true);
      log.info(messageHandler.parse('ASSET_METADATA_EXPORT_COMPLETE'), this.exportConfig.context);
    });
  }

  getAssetsCount(isDir = false): Promise<number | void> {
    const queryParam: any = {
      limit: 1,
      ...this.commonQueryParam,
      skip: 10 ** 100,
    };

    if (isDir) queryParam.query = { is_dir: true };

    log.debug(
      `Querying count of assets${isDir ? ' (folders only)' : ''} with params: ${JSON.stringify(queryParam)}`,
      this.exportConfig.context,
    );

    return this.stack
      .asset()
      .query(queryParam)
      .count()
      .then(({ assets }: any) => {
        log.debug(`Received asset count: ${assets}`, this.exportConfig.context);
        return assets;
      })
      .catch((error: Error) => {
        handleAndLogError(error, { ...this.exportConfig.context }, messageHandler.parse('ASSET_COUNT_QUERY_FAILED'));
      });
  }
  /**
   * @method getAssetsFolders
   * @param {number} totalCount number
   * @returns Promise<any|void>
   */
  getAssetsFolders(totalCount: number | void): Promise<Promise<void> | void> {
    if (!totalCount) return Promise.resolve();

    const queryParam = {
      ...this.commonQueryParam,
      query: { is_dir: true },
    };

    log.debug(`Fetching asset folders with query: ${JSON.stringify(queryParam)}`, this.exportConfig.context);

    const onSuccess = ({ response: { items } }: any) => {
      log.debug(`Fetched ${items?.length || 0} asset folders`, this.exportConfig.context);
      if (!isEmpty(items)) this.assetsFolder.push(...items);
    };

    const onReject = ({ error }: any) => {
      handleAndLogError(error, { ...this.exportConfig.context });
    };

    return this.makeConcurrentCall({
      apiParams: {
        module: 'assets',
        queryParam,
        reject: onReject,
        resolve: onSuccess,
      },
      concurrencyLimit: this.assetConfig.fetchConcurrency,
      module: 'assets folders',
      totalCount,
    }).then(() => {
      if (!isEmpty(this.assetsFolder)) {
        const path = pResolve(this.assetsRootPath, 'folders.json');
        log.debug(`Writing asset folders to ${path}`, this.exportConfig.context);
        new FsUtility({ basePath: this.assetsRootPath }).writeFile(path, this.assetsFolder);
      }
      log.info(
        messageHandler.parse('ASSET_FOLDERS_EXPORT_COMPLETE', this.assetsFolder.length),
        this.exportConfig.context,
      );
    });
  }

  /**
   * @method getVersionedAssets
   * @returns Promise<any|void>
   */
  getVersionedAssets(): Promise<any | void> {
    log.debug('Preparing to fetch versioned assets...', this.exportConfig.context);

    let fs: FsUtility;

    const queryParam = {
      ...this.commonQueryParam,
      except: { BASE: this.assetConfig.invalidKeys },
      include_publish_details: true,
    };

    const versionedAssets = map(this.versionedAssets, (element) => {
      const batch = [];
      const [uid, version]: any = first(entries(element));

      for (let index = 1; index < version; index++) {
        batch.push({ [uid]: index });
      }

      return batch;
    }).flat();

    log.debug(`Prepared ${versionedAssets.length} versioned asset queries`, this.exportConfig.context);
    const apiBatches: Array<any> = chunk(versionedAssets, this.assetConfig.fetchConcurrency);

    const promisifyHandler: CustomPromiseHandler = (input: CustomPromiseHandlerInput) => {
      const { apiParams, batchIndex, index, isLastRequest } = input;
      const batch: Record<string, number> = apiBatches[batchIndex][index];
      const [uid, version]: any = first(entries(batch));

      log.debug(`Fetching versioned asset [UID: ${uid}, Version: ${version}]`, this.exportConfig.context);

      if (apiParams?.queryParam) {
        apiParams.uid = uid;
        apiParams.queryParam.version = version;
        return this.makeAPICall(apiParams, isLastRequest);
      }
      return Promise.resolve();
    };

    const onSuccess = ({ response }: any) => {
      if (!fs && !isEmpty(response)) {
        fs = new FsUtility({
          basePath: pResolve(this.assetsRootPath, 'versions'),
          chunkFileSize: this.assetConfig.chunkFileSize,
          indexFileName: 'versioned-assets.json',
          metaPickKeys: merge(['uid', 'url', 'filename', '_version', 'parent_uid'], this.assetConfig.assetsMetaKeys),
          moduleName: 'assets',
        });
      }
      if (!isEmpty(response)) {
        log.debug(
          `Writing versioned asset: UID=${response.uid}, Version=${response._version}`,
          this.exportConfig.context,
        );
        fs?.writeIntoFile([response], { keyName: ['uid', '_version'], mapKeyVal: true });
      }
    };

    const onReject = ({ error }: any) => {
      handleAndLogError(error, { ...this.exportConfig.context }, messageHandler.parse('ASSET_VERSIONED_QUERY_FAILED'));
    };

    return this.makeConcurrentCall(
      {
        apiBatches,
        apiParams: {
          module: 'asset',
          queryParam,
          reject: onReject,
          resolve: onSuccess,
        },
        concurrencyLimit: this.assetConfig.fetchConcurrency,
        module: 'versioned assets',
        totalCount: versionedAssets.length,
      },
      promisifyHandler,
    ).then(() => {
      fs?.completeFile(true);
      log.info(messageHandler.parse('ASSET_VERSIONED_METADATA_EXPORT_COMPLETE'), this.exportConfig.context);
    });
  }
  async start(): Promise<void> {
    this.assetsRootPath = pResolve(
      this.exportConfig.data,
      this.exportConfig.branchName || '',
      this.assetConfig.dirName,
    );

    log.debug(`Assets root path resolved to: ${this.assetsRootPath}`, this.exportConfig.context);
    log.debug('Fetching assets and folders count...', this.exportConfig.context);
    // NOTE step 1: Get assets and it's folder count in parallel
    const [assetsCount, assetsFolderCount] = await Promise.all([this.getAssetsCount(), this.getAssetsCount(true)]);

    log.debug('Fetching assets and folders data...', this.exportConfig.context);
    // NOTE step 2: Get assets and it's folder data in parallel
    await Promise.all([this.getAssetsFolders(assetsFolderCount), this.getAssets(assetsCount)]);

    // NOTE step 3: Get versioned assets
    if (!isEmpty(this.versionedAssets) && this.assetConfig.includeVersionedAssets) {
      log.debug('Fetching versioned assets metadata...', this.exportConfig.context);
      await this.getVersionedAssets();
    }

    log.debug('Starting download of all assets...', this.exportConfig.context);
    // NOTE step 4: Download all assets
    await this.downloadAssets();

    log.success(messageHandler.parse('ASSET_EXPORT_COMPLETE'), this.exportConfig.context);
  }
}
