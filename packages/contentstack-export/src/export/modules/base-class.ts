import { log } from '@contentstack/cli-utilities';
import chunk from 'lodash/chunk';
import entries from 'lodash/entries';
import fill from 'lodash/fill';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import last from 'lodash/last';
import map from 'lodash/map';

import { ExportConfig, ModuleClassParams } from '../../types';

export type ApiOptions = {
  additionalInfo?: Record<any, any>;
  module: ApiModuleType;
  queryParam?: Record<any, any>;
  reject: (error: any) => void;
  resolve: (value: any) => void;
  uid?: string;
  url?: string;
};

export type EnvType = {
  apiBatches?: number[];
  apiParams?: ApiOptions;
  concurrencyLimit: number;
  module: string;
  totalCount: number;
};

export type CustomPromiseHandlerInput = {
  apiParams?: ApiOptions;
  batchIndex: number;
  element?: Record<string, any>;
  index: number;
  isLastRequest: boolean;
};

export type CustomPromiseHandler = (input: CustomPromiseHandlerInput) => Promise<any>;

export type ApiModuleType =
  | 'asset'
  | 'assets'
  | 'content-type'
  | 'content-types'
  | 'download-asset'
  | 'entries'
  | 'entry'
  | 'export-taxonomy'
  | 'stack'
  | 'stacks'
  | 'versioned-entries';

export default abstract class BaseClass {
  readonly client: any;
  public exportConfig: ExportConfig;

  constructor({ exportConfig, stackAPIClient }: Omit<ModuleClassParams, 'moduleName'>) {
    this.client = stackAPIClient;
    this.exportConfig = exportConfig;
  }

  get stack(): any {
    return this.client;
  }

  protected applyQueryFilters(requestObject: any, moduleName: string): any {
    if (this.exportConfig.query?.modules?.[moduleName]) {
      const moduleQuery = this.exportConfig.query.modules[moduleName];
      // Merge the query parameters with existing requestObject
      if (moduleQuery) {
        if (!requestObject.query) {
          requestObject.query = moduleQuery;
        }
        Object.assign(requestObject.query, moduleQuery);
      }
    }
    return requestObject;
  }

  delay(ms: number): Promise<void> {
    /* eslint-disable no-promise-executor-return */
    return new Promise((resolve) => setTimeout(resolve, ms <= 0 ? 0 : ms));
  }

  /**
   * @method logMsgAndWaitIfRequired
   * @param module string
   * @param start number
   * @param batchNo number
   * @returns Promise<void>
   */
  async logMsgAndWaitIfRequired(module: string, start: number, batchNo: number): Promise<void> {
    const end = Date.now();
    const exeTime = end - start;
    log.success(
      `Batch No. ${batchNo} of ${module} is complete. Time taken: ${exeTime} milliseconds`,
      this.exportConfig.context,
    );

    if (this.exportConfig.modules.assets.displayExecutionTime) {
      console.log(
        `Time taken to execute: ${exeTime} milliseconds; wait time: ${
          exeTime < 1000 ? 1000 - exeTime : 0
        } milliseconds`,
      );
    }

    if (exeTime < 1000) await this.delay(1000 - exeTime);
  }

  /**
   * @method makeAPICall
   * @param {Record<string, any>} options - Api related params
   * @param {Record<string, any>} isLastRequest - Boolean
   * @returns Promise<any>
   */
  makeAPICall(
    { additionalInfo, module: moduleName, queryParam = {}, reject, resolve, uid = '', url = '' }: ApiOptions,
    isLastRequest = false,
  ): Promise<any> {
    switch (moduleName) {
      case 'asset':
        return this.stack
          .asset(uid)
          .fetch(queryParam)
          .then((response: any) => resolve({ additionalInfo, isLastRequest, response }))
          .catch((error: Error) => reject({ additionalInfo, error, isLastRequest }));
      case 'assets':
        return this.stack
          .asset()
          .query(queryParam)
          .find()
          .then((response: any) => resolve({ additionalInfo, isLastRequest, response }))
          .catch((error: Error) => reject({ additionalInfo, error, isLastRequest }));
      case 'download-asset':
        return this.stack
          .asset()
          .download({ responseType: 'stream', url })
          .then((response: any) => resolve({ additionalInfo, isLastRequest, response }))
          .catch((error: any) => reject({ additionalInfo, error, isLastRequest }));
      case 'export-taxonomy':
        return this.stack
          .taxonomy(uid)
          .export(queryParam)
          .then((response: any) => resolve({ response, uid }))
          .catch((error: any) => reject({ error, uid }));
      default:
        return Promise.resolve();
    }
  }

  makeConcurrentCall(env: EnvType, promisifyHandler?: CustomPromiseHandler): Promise<void> {
    const { apiBatches, apiParams, concurrencyLimit, module, totalCount } = env;

    /* eslint-disable no-async-promise-executor */
    return new Promise(async (resolve) => {
      let batchNo = 0;
      let isLastRequest = false;
      const batch = fill(Array.from({ length: Number.parseInt(String(totalCount / 100), 10) }), 100);

      if (totalCount % 100) batch.push(100);

      const batches: Array<any | number> =
        apiBatches ||
        chunk(
          map(batch, (skip: number, i: number) => skip * i),
          concurrencyLimit,
        );

      /* eslint-disable no-promise-executor-return */
      if (isEmpty(batches)) return resolve();

      for (const [batchIndex, batch] of entries(batches)) {
        batchNo += 1;
        const allPromise = [];
        const start = Date.now();

        for (const [index, element] of entries(batch)) {
          let promise;
          isLastRequest = isEqual(last(batch), element) && isEqual(last(batches), batch);

          if (promisifyHandler instanceof Function) {
            promise = promisifyHandler({
              apiParams,
              batchIndex: Number(batchIndex),
              element,
              index: Number(index),
              isLastRequest,
            });
          } else if (apiParams?.queryParam) {
            apiParams.queryParam.skip = element;
            promise = this.makeAPICall(apiParams, isLastRequest);
          }

          allPromise.push(promise);
        }

        /* eslint-disable no-await-in-loop */
        await Promise.allSettled(allPromise);
        /* eslint-disable no-await-in-loop */
        await this.logMsgAndWaitIfRequired(module, start, batchNo);

        if (isLastRequest) resolve();
      }
    });
  }
}
