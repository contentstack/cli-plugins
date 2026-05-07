import { DefaultConfig } from '../types';

const config: DefaultConfig = {
  contentVersion: 2,
  host: 'https://api.contentstack.io/v3',

  // Query-based export module configuration
  modules: {
    // Always export - general modules
    general: ['stack', 'locales', 'environments'],
    // Query target modules
    queryable: ['content-types'],
    dependent: ['global-fields', 'extensions', 'marketplace-apps', 'taxonomies', 'personalize'],
    // Content modules
    content: ['entries', 'assets'],
    // Export order based on dependencies
    exportOrder: [
      'stack',
      'locales',
      'environments',
      'content-types',
      'global-fields',
      'extensions',
      'taxonomies',
      'entries',
      'assets',
    ],
  },
  // Query-specific settings
  queryConfig: {
    maxRecursionDepth: 10,
    batchSize: 100,
    metadataFileName: '_query-meta.json',
    validation: {
      maxQueryDepth: 5,
      maxArraySize: 1000,
      allowedDateFormats: ['ISO8601', 'YYYY-MM-DD', 'MM/DD/YYYY'],
    },
  },
  // API endpoints
  apis: {
    stacks: '/stacks/',
    locales: '/locales/',
    environments: '/environments/',
    content_types: '/content_types/',
    global_fields: '/global_fields/',
    extensions: '/extensions/',
    taxonomies: '/taxonomies/',
    entries: '/entries/',
    assets: '/assets/',
  },
  // Performance settings
  fetchConcurrency: 5,
  writeConcurrency: 5,
  maxCTReferenceDepth: 20,
  // Optional settings
};

export default config;
