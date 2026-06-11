export interface ExportOptions {
  outputDir: string;
  downloadAssets?: boolean;
  includeDrafts?: boolean;
  includeArchived?: boolean;
  verbose?: boolean;
  spaceId?: string;
  managementToken?: string;
  /** Contentful environment to export (defaults to the space default). */
  environmentId?: string;
}

export interface ExportResult {
  exportFile: string;
  assetsDir?: string;
}

export interface ConvertOptions {
  input: string;
  outputDir: string;
  affix?: string;
  masterLocale?: string;
  verbose?: boolean;
  /**
   * Organization UID, used to fetch marketplace app manifests from Developer Hub
   * for `app`-widget fields (e.g. Cloudinary). Mirrors the API's explicit orgId
   * input. Falls back to csdx's oauthOrgUid when omitted.
   */
  orgUid?: string;
}

export interface ConvertResult {
  bundleDir: string;
  mapperPath: string;
  stats: { locales: number; contentTypes: number; entries: number };
}

export interface LegacyAdapter {
  readonly legacy: string;
  export(options: ExportOptions): Promise<ExportResult>;
  convert(options: ConvertOptions): Promise<ConvertResult>;
}
