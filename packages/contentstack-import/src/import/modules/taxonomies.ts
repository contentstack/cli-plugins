import { join } from 'node:path';
import values from 'lodash/values';
import isEmpty from 'lodash/isEmpty';
import { log, handleAndLogError, CLIProgressManager } from '@contentstack/cli-utilities';
import { PATH_CONSTANTS } from '../../constants';

import BaseClass, { ApiOptions } from './base-class';
import { fsUtil, fileHelper, MODULE_CONTEXTS, MODULE_NAMES, PROCESS_STATUS, PROCESS_NAMES } from '../../utils';
import { ModuleClassParams, TaxonomiesConfig } from '../../types';

export default class ImportTaxonomies extends BaseClass {
  private taxonomiesMapperDirPath: string;
  private taxonomiesFolderPath: string;
  private taxSuccessPath: string;
  private taxFailsPath: string;
  private taxonomiesConfig: TaxonomiesConfig;
  private taxonomies: Record<string, unknown>;
  private termsMapperDirPath: string;
  private termsSuccessPath: string;
  private termsFailsPath: string;
  private localesFilePath: string;
  private envUidMapperPath: string;
  private envUidMapper: Record<string, string> = {};
  private isLocaleBasedStructure: boolean = false;
  public createdTaxonomies: Record<string, unknown> = {};
  public failedTaxonomies: Record<string, unknown> = {};
  public createdTerms: Record<string, Record<string, unknown>> = {};
  public failedTerms: Record<string, Record<string, unknown>> = {};

  constructor({ importConfig, stackAPIClient }: ModuleClassParams) {
    super({ importConfig, stackAPIClient });
    this.importConfig.context.module = MODULE_CONTEXTS.TAXONOMIES;
    this.currentModuleName = MODULE_NAMES[MODULE_CONTEXTS.TAXONOMIES];
    this.taxonomiesConfig = importConfig.modules.taxonomies;
    this.taxonomiesMapperDirPath = join(
      importConfig.backupDir,
      PATH_CONSTANTS.MAPPER,
      PATH_CONSTANTS.MAPPER_MODULES.TAXONOMIES,
    );
    this.termsMapperDirPath = join(this.taxonomiesMapperDirPath, PATH_CONSTANTS.MAPPER_MODULES.TAXONOMY_TERMS);
    this.taxonomiesFolderPath = join(importConfig.contentDir, this.taxonomiesConfig.dirName);
    this.taxSuccessPath = join(this.taxonomiesMapperDirPath, PATH_CONSTANTS.FILES.SUCCESS);
    this.taxFailsPath = join(this.taxonomiesMapperDirPath, PATH_CONSTANTS.FILES.FAILS);
    this.termsSuccessPath = join(this.termsMapperDirPath, PATH_CONSTANTS.FILES.SUCCESS);
    this.termsFailsPath = join(this.termsMapperDirPath, PATH_CONSTANTS.FILES.FAILS);
    this.localesFilePath = join(
      importConfig.backupDir,
      importConfig.modules.locales.dirName,
      importConfig.modules.locales.fileName,
    );
    this.envUidMapperPath = join(
      importConfig.backupDir,
      PATH_CONSTANTS.MAPPER,
      PATH_CONSTANTS.MAPPER_MODULES.ENVIRONMENTS,
      PATH_CONSTANTS.FILES.UID_MAPPING,
    );
  }

  // --- Lifecycle ---

  /**
   * @method start
   * @returns {Promise<void>} Promise<void>
   */
  async start(): Promise<void> {
    try {
      log.debug('Starting taxonomies import process...', this.importConfig.context);

      const [taxonomiesCount, publishJobCount] = await this.analyzeTaxonomies();
      if (taxonomiesCount === 0) {
        log.info('No taxonomies found to import', this.importConfig.context);
        return;
      }

      await this.prepareMapperDirectories();

      // Check if locale-based structure exists before import
      this.isLocaleBasedStructure = this.detectAndScanLocaleStructure();

      const progress = this.createNestedProgress(this.currentModuleName);
      this.initializeTaxonomiesProgress(progress, taxonomiesCount, publishJobCount);

      progress
        .startProcess(PROCESS_NAMES.TAXONOMIES_IMPORT)
        .updateStatus(PROCESS_STATUS[PROCESS_NAMES.TAXONOMIES_IMPORT].IMPORTING, PROCESS_NAMES.TAXONOMIES_IMPORT);
      log.debug('Starting taxonomies import', this.importConfig.context);

      if (this.isLocaleBasedStructure) {
        log.debug('Detected locale-based folder structure for taxonomies', this.importConfig.context);
        await this.importTaxonomiesByLocale();
      } else {
        log.debug('Using legacy folder structure for taxonomies', this.importConfig.context);
        await this.importTaxonomiesLegacy();
      }

      progress.completeProcess(PROCESS_NAMES.TAXONOMIES_IMPORT, true);

      if (publishJobCount > 0) {
        progress
          .startProcess(PROCESS_NAMES.TAXONOMIES_PUBLISH)
          .updateStatus(
            PROCESS_STATUS[PROCESS_NAMES.TAXONOMIES_PUBLISH].PUBLISHING,
            PROCESS_NAMES.TAXONOMIES_PUBLISH,
          );
        await this.processTaxonomyPublishing();
        progress.completeProcess(PROCESS_NAMES.TAXONOMIES_PUBLISH, true);
      }

      this.createSuccessAndFailedFile();
      this.completeProgressWithMessage();
    } catch (error) {
      this.completeProgress(false, error?.message || 'Taxonomies import failed');
      handleAndLogError(error, { ...this.importConfig.context });
    }
  }

  // --- Import ---

  /**
   * create taxonomy and enter success & failure related data into taxonomies mapper file
   * @method importTaxonomies
   * @async
   * @returns {Promise<any>} Promise<any>
   */
  async importTaxonomies({ apiContent, localeCode }: { apiContent: any[]; localeCode?: string }): Promise<void> {
    if (!apiContent || apiContent?.length === 0) {
      log.debug('No taxonomies to import', this.importConfig.context);
      return;
    }

    const onSuccess = ({ apiData }: any) => this.handleSuccess(apiData, localeCode);
    const onReject = ({ error, apiData }: any) => this.handleFailure(error, apiData, localeCode);

    await this.makeConcurrentCall(
      {
        apiContent,
        processName: 'import taxonomies',
        apiParams: {
          serializeData: this.serializeTaxonomy.bind(this),
          reject: onReject,
          resolve: onSuccess,
          entity: 'import-taxonomy',
          includeParamOnCompletion: true,
          queryParam: {
            locale: localeCode,
          },
        },
        concurrencyLimit: this.importConfig.concurrency || this.importConfig.fetchConcurrency || 1,
      },
      undefined,
      false,
    );
  }

  /**
   * Import taxonomies using legacy structure (taxonomies/{uid}.json)
   */
  async importTaxonomiesLegacy(): Promise<void> {
    const apiContent = values(this.taxonomies);
    await this.importTaxonomies({ apiContent });
  }

  /**
   * Import taxonomies using locale-based structure (taxonomies/{locale}/{uid}.json)
   */
  async importTaxonomiesByLocale(): Promise<void> {
    const locales = this.loadAvailableLocales();
    const apiContent = values(this.taxonomies);

    for (const localeCode of Object.keys(locales)) {
      await this.importTaxonomies({ apiContent, localeCode });
    }
  }

  handleSuccess(apiData: any, locale?: string) {
    const { taxonomy, terms } = apiData || {};
    const taxonomyUID = taxonomy?.uid;
    const taxonomyName = taxonomy?.name;
    const termsCount = Object.keys(terms || {}).length;

    this.createdTaxonomies[taxonomyUID] = taxonomy;
    this.createdTerms[taxonomyUID] = terms;

    this.progressManager?.tick(
      true,
      `taxonomy: ${taxonomyName || taxonomyUID}`,
      null,
      PROCESS_NAMES.TAXONOMIES_IMPORT,
    );

    log.success(
      `Taxonomy '${taxonomyUID}' imported successfully${locale ? ` for locale: ${locale}` : ''}!`,
      this.importConfig.context,
    );
    log.debug(
      `Created taxonomy '${taxonomyName}' with ${termsCount} terms${locale ? ` for locale: ${locale}` : ''}`,
      this.importConfig.context,
    );
  }

  handleFailure(error: any, apiData: any, locale?: string) {
    const taxonomyUID = apiData?.taxonomy?.uid;
    const taxonomyName = apiData?.taxonomy?.name;

    if (error?.status === 409 && error?.statusText === 'Conflict') {
      this.progressManager?.tick(
        true,
        null,
        `taxonomy: ${taxonomyName || taxonomyUID} (already exists)`,
        PROCESS_NAMES.TAXONOMIES_IMPORT,
      );
      log.info(
        `Taxonomy '${taxonomyUID}' already exists ${locale ? ` for locale: ${locale}` : ''}!`,
        this.importConfig.context,
      );
      this.createdTaxonomies[taxonomyUID] = apiData?.taxonomy;
      this.createdTerms[taxonomyUID] = apiData?.terms;
      return;
    }

    const errMsg = error?.errorMessage || error?.errors?.taxonomy || error?.errors?.term || error?.message;

    this.progressManager?.tick(
      false,
      `taxonomy: ${taxonomyName || taxonomyUID}`,
      errMsg || 'Failed to import taxonomy',
      PROCESS_NAMES.TAXONOMIES_IMPORT,
    );

    if (errMsg) {
      log.error(
        `Taxonomy '${taxonomyUID}' failed to import${locale ? ` for locale: ${locale}` : ''}! ${errMsg}`,
        this.importConfig.context,
      );
    } else {
      handleAndLogError(
        error,
        { ...this.importConfig.context, taxonomyUID, locale },
        `Taxonomy '${taxonomyUID}' failed`,
      );
    }

    this.failedTaxonomies[taxonomyUID] = apiData?.taxonomy;
    this.failedTerms[taxonomyUID] = apiData?.terms;
  }

  /**
   * @method serializeTaxonomy
   * @param {ApiOptions} apiOptions ApiOptions
   * @returns {ApiOptions} ApiOptions
   */
  serializeTaxonomy(apiOptions: ApiOptions): ApiOptions {
    const {
      apiData,
      queryParam: { locale },
    } = apiOptions;
    const taxonomyUID = apiData?.uid;

    if (!taxonomyUID) {
      log.debug('No taxonomy UID provided for serialization', this.importConfig.context);
      apiOptions.apiData = undefined;
      return apiOptions;
    }

    const context = locale ? ` for locale: ${locale}` : '';
    log.debug(`Serializing taxonomy: ${taxonomyUID}${context}`, this.importConfig.context);

    // Determine file path - if locale is provided, use it directly, otherwise search
    const filePath = locale
      ? join(this.taxonomiesFolderPath, locale, `${taxonomyUID}.json`)
      : this.findTaxonomyFilePath(taxonomyUID);

    if (!filePath || !fileHelper.fileExistsSync(filePath)) {
      log.debug(`Taxonomy file not found for: ${taxonomyUID}${context}`, this.importConfig.context);
      apiOptions.apiData = undefined;
      return apiOptions;
    }

    const taxonomyDetails = this.loadTaxonomyFile(filePath);
    if (taxonomyDetails) {
      const termCount = Object.keys(taxonomyDetails?.terms || {}).length;
      log.debug(`Taxonomy has ${termCount} term entries${context}`, this.importConfig.context);

      apiOptions.apiData = {
        filePath,
        taxonomy: taxonomyDetails?.taxonomy,
        terms: taxonomyDetails?.terms,
      };
    } else {
      apiOptions.apiData = undefined;
    }

    return apiOptions;
  }

  loadTaxonomyFile(filePath: string): Record<string, unknown> | undefined {
    if (!fileHelper.fileExistsSync(filePath)) {
      log.debug(`File does not exist: ${filePath}`, this.importConfig.context);
      return undefined;
    }

    try {
      const taxonomyDetails = fsUtil.readFile(filePath, true) as Record<string, unknown>;
      log.debug(`Successfully loaded taxonomy from: ${filePath}`, this.importConfig.context);
      return taxonomyDetails;
    } catch (error) {
      log.debug(`Error loading taxonomy file: ${filePath}`, this.importConfig.context);
      return undefined;
    }
  }

  findTaxonomyFilePath(taxonomyUID: string): string | undefined {
    if (this.isLocaleBasedStructure) {
      return this.findTaxonomyInLocaleFolders(taxonomyUID);
    }

    const legacyPath = join(this.taxonomiesFolderPath, `${taxonomyUID}.json`);
    return fileHelper.fileExistsSync(legacyPath) ? legacyPath : undefined;
  }

  findTaxonomyInLocaleFolders(taxonomyUID: string): string | undefined {
    const locales = this.loadAvailableLocales();

    for (const localeCode of Object.keys(locales)) {
      const filePath = join(this.taxonomiesFolderPath, localeCode, `${taxonomyUID}.json`);
      if (fileHelper.fileExistsSync(filePath)) {
        return filePath;
      }
    }

    return undefined;
  }

  loadAvailableLocales(): Record<string, string> {
    if (!fileHelper.fileExistsSync(this.localesFilePath)) {
      log.debug('No locales file found', this.importConfig.context);
      return {};
    }

    try {
      const localesData = fsUtil.readFile(this.localesFilePath, true) as Record<string, Record<string, any>>;
      const locales: Record<string, string> = {};
      const masterCode = this.importConfig.master_locale?.code || 'en-us';
      locales[masterCode] = masterCode;

      for (const [, locale] of Object.entries(localesData || {})) {
        if (locale?.code) {
          locales[locale.code] = locale.code;
        }
      }

      log.debug(`Loaded ${Object.keys(locales).length} locales from file`, this.importConfig.context);
      return locales;
    } catch (error) {
      log.debug('Error loading locales file', this.importConfig.context);
      return {};
    }
  }

  /**
   * Detect if locale-based folder structure exists (taxonomies/{locale}/{uid}.json)
   */
  detectAndScanLocaleStructure(): boolean {
    const masterLocaleCode = this.importConfig.master_locale?.code || 'en-us';
    const masterLocaleFolder = join(this.taxonomiesFolderPath, masterLocaleCode);

    if (!fileHelper.fileExistsSync(masterLocaleFolder)) {
      log.debug('No locale-based folder structure detected', this.importConfig.context);
      return false;
    }

    log.debug('Locale-based folder structure detected', this.importConfig.context);
    return true;
  }

  // --- Progress ---

  /**
   * Registers nested progress for taxonomy import and optional taxonomy publish when publish jobs exist.
   */
  initializeTaxonomiesProgress(progress: CLIProgressManager, taxonomyCount: number, publishJobCount: number): void {
    progress.addProcess(PROCESS_NAMES.TAXONOMIES_IMPORT, taxonomyCount);
    if (publishJobCount > 0) {
      progress.addProcess(PROCESS_NAMES.TAXONOMIES_PUBLISH, publishJobCount);
    }
  }

  // --- Publish ---

  /**
   * Reads source env UID → destination stack env UID map produced during environments import.
   */
  private readEnvUidMapperSync(): Record<string, string> {
    if (!fileHelper.fileExistsSync(this.envUidMapperPath)) {
      log.debug(`Environment UID mapper not found at ${this.envUidMapperPath}`, this.importConfig.context);
      return {};
    }

    try {
      const raw = fsUtil.readFile(this.envUidMapperPath, true) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw || {})) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          out[k] = String(v);
        }
      }
      return out;
    } catch {
      log.debug('Failed to read environment UID mapper', this.importConfig.context);
      return {};
    }
  }

  private countPublishEligibleTaxonomies(envMapper: Record<string, string>): number {
    let count = 0;
    for (const key of Object.keys(this.taxonomies || {})) {
      const meta = this.taxonomies[key] as Record<string, any>;
      const taxonomyUid = meta?.uid || key;
      const filePath = this.findTaxonomyFilePath(taxonomyUid);
      if (!filePath) continue;

      const details = this.loadTaxonomyFile(filePath);
      const tax = details?.taxonomy as Record<string, any> | undefined;
      if (!tax?.publish_details?.length || !tax?.locale) continue;

      const hasMapped = (tax.publish_details as any[]).some(
        (p: any) => p?.environment && envMapper[String(p.environment)],
      );
      if (hasMapped) count++;
    }
    return count;
  }

  private collectTaxonomyPublishJobs(): Array<{ taxonomy: Record<string, any> }> {
    const jobs: Array<{ taxonomy: Record<string, any> }> = [];
    const seen = new Set<string>();

    for (const key of Object.keys(this.taxonomies || {})) {
      const meta = this.taxonomies[key] as Record<string, any>;
      const taxonomyUid = meta?.uid || key;
      if (seen.has(taxonomyUid)) continue;

      const filePath = this.findTaxonomyFilePath(taxonomyUid);
      if (!filePath) continue;

      const details = this.loadTaxonomyFile(filePath);
      const tax = details?.taxonomy as Record<string, any> | undefined;
      if (!tax?.publish_details?.length || !tax?.locale) continue;

      seen.add(taxonomyUid);
      jobs.push({ taxonomy: tax });
    }

    return jobs;
  }

  private loadEnvUidMapper(): void {
    this.envUidMapper = this.readEnvUidMapperSync();
    if (isEmpty(this.envUidMapper)) {
      log.warn(
        'Environment UID mapper is empty; taxonomy publishing is skipped. Import environments first or ensure mapper/environments/uid-mapping.json exists.',
        this.importConfig.context,
      );
    }
  }

  async processTaxonomyPublishing(): Promise<void> {
    this.loadEnvUidMapper();
    const jobs = this.collectTaxonomyPublishJobs();

    if (jobs.length === 0) {
      log.debug('No taxonomies with publish_details to publish', this.importConfig.context);
      return;
    }

    log.info('Starting taxonomy publishing process', this.importConfig.context);

    const onSuccess = ({ apiData }: any) => {
      const taxonomyUid = apiData?.items?.[0]?.uid;
      this.progressManager?.tick(
        true,
        `taxonomy published: ${taxonomyUid}`,
        null,
        PROCESS_NAMES.TAXONOMIES_PUBLISH,
      );
      log.success(`Published taxonomy '${taxonomyUid}'`, this.importConfig.context);
    };

    const onReject = ({ error, apiData }: any) => {
      const taxonomyUid = apiData?.items?.[0]?.uid;
      handleAndLogError(
        error,
        { ...this.importConfig.context, taxonomyUid },
        `Failed to publish taxonomy '${taxonomyUid}'`,
      );
      this.progressManager?.tick(
        false,
        `taxonomy publish: ${taxonomyUid}`,
        (error as Error)?.message || `Failed to publish taxonomy '${taxonomyUid}'`,
        PROCESS_NAMES.TAXONOMIES_PUBLISH,
      );
    };

    await this.makeConcurrentCall(
      {
        apiContent: jobs as unknown as Record<string, any>[],
        processName: 'publish taxonomies',
        apiParams: {
          serializeData: this.serializePublishTaxonomies.bind(this),
          reject: onReject,
          resolve: onSuccess,
          entity: 'publish-taxonomies',
          includeParamOnCompletion: true,
        },
        concurrencyLimit: this.importConfig.concurrency || this.importConfig.fetchConcurrency || 1,
      },
      undefined,
      false,
    );
  }

  /**
   * Builds taxonomy publish payload: destination env UIDs from mapper, locales from taxonomy.locale, items: [{ uid }].
   */
  serializePublishTaxonomies(apiOptions: ApiOptions): ApiOptions {
    const job = apiOptions.apiData as { taxonomy?: Record<string, any> };
    const taxonomy = job?.taxonomy;

    if (!taxonomy?.publish_details?.length || !taxonomy?.locale) {
      apiOptions.apiData = undefined;
      return apiOptions;
    }

    const environments: string[] = [];
    for (const pub of taxonomy.publish_details as any[]) {
      const sourceEnvUid = pub?.environment;
      if (!sourceEnvUid) continue;
      const destUid = this.envUidMapper[String(sourceEnvUid)];
      if (destUid && !environments.includes(destUid)) {
        environments.push(destUid);
      }
    }

    if (environments.length === 0) {
      apiOptions.apiData = undefined;
      return apiOptions;
    }

    const locales = [String(taxonomy.locale)];
    apiOptions.apiData = {
      environments,
      locales,
      items: [{ uid: taxonomy.uid }],
    };

    return apiOptions;
  }

  // --- Mapper output ---

  /**
   * create taxonomies success and fail in (mapper/taxonomies)
   * create terms success and fail in (mapper/taxonomies/terms)
   * @method createSuccessAndFailedFile
   */
  createSuccessAndFailedFile() {
    log.debug('Creating success and failed files for taxonomies and terms', this.importConfig.context);

    const createdTaxCount = Object.keys(this.createdTaxonomies || {})?.length;
    const failedTaxCount = Object.keys(this.failedTaxonomies || {})?.length;
    const createdTermsCount = Object.keys(this.createdTerms || {})?.length;
    const failedTermsCount = Object.keys(this.failedTerms || {})?.length;

    log.debug(
      `Summary - Created taxonomies: ${createdTaxCount}, Failed taxonomies: ${failedTaxCount}`,
      this.importConfig.context,
    );
    log.debug(
      `Summary - Created terms: ${createdTermsCount}, Failed terms: ${failedTermsCount}`,
      this.importConfig.context,
    );

    if (this.createdTaxonomies !== undefined && !isEmpty(this.createdTaxonomies)) {
      fsUtil.writeFile(this.taxSuccessPath, this.createdTaxonomies);
      log.debug(
        `Written ${createdTaxCount} successful taxonomies to file: ${this.taxSuccessPath}`,
        this.importConfig.context,
      );
    }

    if (this.failedTaxonomies !== undefined && !isEmpty(this.failedTaxonomies)) {
      fsUtil.writeFile(this.taxFailsPath, this.failedTaxonomies);
      log.debug(`Written ${failedTaxCount} failed taxonomies to file: ${this.taxFailsPath}`, this.importConfig.context);
    }

    if (this.createdTerms !== undefined && !isEmpty(this.createdTerms)) {
      fsUtil.writeFile(this.termsSuccessPath, this.createdTerms);
      log.debug(
        `Written successful terms for ${createdTermsCount} taxonomies to file: ${this.termsSuccessPath}`,
        this.importConfig.context,
      );
    }

    if (this.failedTerms !== undefined && !isEmpty(this.failedTerms)) {
      fsUtil.writeFile(this.termsFailsPath, this.failedTerms);
      log.debug(
        `Written failed terms for ${failedTermsCount} taxonomies to file: ${this.termsFailsPath}`,
        this.importConfig.context,
      );
    }
  }

  // --- Analyze & prepare ---

  private async analyzeTaxonomies(): Promise<[number, number]> {
    return this.withLoadingSpinner('TAXONOMIES: Analyzing import data...', async () => {
      log.debug('Checking for taxonomies folder existence', this.importConfig.context);

      if (!fileHelper.fileExistsSync(this.taxonomiesFolderPath)) {
        log.info(`No Taxonomies Found! - '${this.taxonomiesFolderPath}'`, this.importConfig.context);
        return [0, 0];
      }

      log.debug(`Found taxonomies folder: ${this.taxonomiesFolderPath}`, this.importConfig.context);

      this.taxonomies = fsUtil.readFile(join(this.taxonomiesFolderPath, 'taxonomies.json'), true) as Record<
        string,
        unknown
      >;

      this.isLocaleBasedStructure = this.detectAndScanLocaleStructure();

      const taxonomyCount = Object.keys(this.taxonomies || {}).length;
      const envMapper = this.readEnvUidMapperSync();
      const publishJobCount = this.countPublishEligibleTaxonomies(envMapper);

      log.debug(
        `Loaded ${taxonomyCount} taxonomy items; ${publishJobCount} eligible for publish (mapped environments).`,
        this.importConfig.context,
      );

      return [taxonomyCount, publishJobCount];
    });
  }

  private async prepareMapperDirectories(): Promise<void> {
    log.debug('Creating mapper directories', this.importConfig.context);
    await fsUtil.makeDirectory(this.taxonomiesMapperDirPath);
    await fsUtil.makeDirectory(this.termsMapperDirPath);
    log.debug('Created taxonomies and terms mapper directories', this.importConfig.context);
  }
}
