import { Stack as DeliveryStack } from '@contentstack/delivery-sdk';
import type { ContentstackClient } from '@contentstack/cli-utilities';

// Extract Stack type from ContentstackClient
type ManagementStack = ReturnType<ContentstackClient['stack']>;

export enum OperationType {
  PUBLISH = 'publish',
  UNPUBLISH = 'unpublish',
  DELETE = 'delete',
  MOVE = 'move',
}

export enum PublishMode {
  BULK = 'bulk',
  SINGLE = 'single',
}

export enum ResourceType {
  ENTRY = 'entry',
  ASSET = 'asset',
  TAXONOMY = 'taxonomy',
}

export enum FilterType {
  DRAFT = 'draft',
  MODIFIED = 'modified',
  UNPUBLISHED = 'unpublished',
  NON_LOCALIZED = 'non-localized',
}

export interface FilterConfig {
  filterType?: FilterType;
  onlyUnpublished?: boolean;
  modifiedAfter?: Date;
}

export interface BulkOperationConfig {
  // Stack identification
  alias?: string;
  apiKey?: string;
  stackApiKey?: string;
  managementToken?: string;

  // Operation
  operation?: string;
  resourceType?: string;

  // Target environments and locales
  environment?: string;
  environments?: string[];
  environmentUids?: string[]; // Store environment UIDs for filtering
  locales?: string[];

  // Entry-specific options
  contentTypes?: string[];
  includeVariants?: boolean;

  // Asset-specific options
  folderUid?: string;
  dataDir?: string;
  dryRun?: boolean;

  // Cross-publish
  sourceEnv?: string;

  // API configuration
  publishMode?: PublishMode;
  apiVersion?: string;

  // Filtering and selection
  branch?: string;
  filters?: FilterConfig;
  filter?: string;

  // Retry, reliability, and operations log
  retryFailed?: string;
  revert?: string;
  bulkOperationFolder?: string;
  maxRetries?: number;

  // Rate limiting
  rateLimit?: {
    maxConcurrent?: number;
    requestsPerSecond?: number;
  };

  // Allow additional properties
  [key: string]: any;
}

export interface BulkOperationResult {
  success: number;
  failed: number;
  total: number;
  retried?: number;
  duration?: number;
  successCount?: number;
  failureCount?: number;
  skipped?: number;
  logFiles?: {
    success?: string;
    failure?: string;
  };
  [key: string]: any;
}

export interface FetchOptions {
  skip?: number;
  limit?: number;
  locale?: string;
  contentType?: string;
  query?: Record<string, any>;
  filters?: Record<string, any>;
  [key: string]: any;
}

export interface Entry {
  uid: string;
  content_type_uid: string;
  _version: number;
  _workflow?: { uid: string };
  publish_details?: PublishDetails[];
  [key: string]: any;
}

export interface PublishDetails {
  environment: string;
  locale: string;
  version?: number;
  [key: string]: any;
}

export interface Asset {
  uid: string;
  filename?: string;
  title?: string;
  _version?: number;
  publish_details?: PublishDetails[];
  _asset_scan_status?: 'pending' | 'clean' | 'quarantined';
  [key: string]: any;
}

export interface TaxonomyPublishItem {
  uid: string;
}

export interface TaxonomyPublishData {
  uid: string;
  name: string;
}

export interface TaxonomyPublishPayload {
  locales: string[];
  environments: string[];
  items: TaxonomyPublishItem[];
}

export interface TaxonomyPublishJobResponse {
  notice?: string;
  job_id?: string;
  [key: string]: unknown;
}

/** Delivery SDK Stack type from @contentstack/delivery-sdk package */
export type { DeliveryStack };
/** Management SDK Stack type from @contentstack/cli-utilities */
export type { ManagementStack };

export interface StackConfig {
  apiKey?: string;
  alias?: string;
  managementToken?: string;
  host?: string;
  environment?: string;
  deliveryToken?: string;
  cda?: string;
  branch?: string;
  region?: string;
}

export interface Clients {
  managementStack: ManagementStack;
  deliveryStack: DeliveryStack | null;
}

export interface CommandFlags {
  // Stack identification
  alias?: string;
  'stack-api-key'?: string;

  // Operation
  operation?: string;

  // Entry-specific flags
  'content-types'?: string[];
  filter?: string;
  'include-variants'?: boolean;

  // Asset-specific flags
  'folder-uid'?: string;
  'data-dir'?: string;
  'dry-run'?: boolean;

  /** AM bulk delete/move */
  'space-uid'?: string;
  'org-uid'?: string;
  workspace?: string;
  locale?: string;
  'asset-uids-file'?: string;
  'target-folder-uid'?: string;

  // Target environments and locales
  environments?: string[];
  locales?: string[];

  // Cross-publish
  'source-env'?: string;
  'source-alias'?: string;

  // API configuration
  'api-version'?: string;
  'publish-mode'?: string;

  // Retry, reliability, and operations log
  'max-retries'?: number;
  'retry-failed'?: string;
  revert?: string;
  'bulk-operation-file'?: string;

  // Filtering and selection
  branch?: string;

  // Configuration and control
  config?: string;
  yes?: boolean;

  // Allow additional properties
  [key: string]: any;
}

export interface EntryPublishData {
  type?: 'entry';
  uid: string;
  content_type: string;
  locale: string;
  version?: number;
  publish_details?: PublishDetails[];
  // Variant support
  variants?: Array<{ uid: string }>;
  variant_rules?: {
    publish_latest_base: boolean;
    publish_latest_base_conditionally: boolean;
  };
}
export interface AssetPublishData {
  type?: 'asset';
  uid: string;
  locale: string;
  version?: number;
  publish_details?: PublishDetails[];
  _asset_scan_status?: 'pending' | 'clean' | 'quarantined';
}

/** One row for AM bulk-delete payload `{ uid, locale }[]`. */
export interface AmBulkDeleteItem {
  uid: string;
  locale: string;
}

/** Normalized outcome from AM bulk delete/move calls (CLI layer). */
export interface AmBulkOperationResult {
  success: boolean;
  notice?: string;
  jobId?: string;
  error?: string;
}

export interface BulkJobResult {
  success: number;
  failed: number;
  jobId: string;
  status: string;
  items?: any[];
  total?: number;
  retried?: number;
  duration?: number;
}

export interface BulkJobStatus {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
}

export interface BulkJobDetails {
  jobId: string;
  status: string;
  totalItems: number;
  succeeded: number;
  failed: number;
  inProgress: number;
  createdAt?: string;
  completedAt?: string;
  errors?: Array<{
    uid: string;
    error: string;
    details?: any;
  }>;
}

export enum OperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  SUCCESS = 'success',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited',
}

export interface QueueItem<T = any> {
  id: string;
  type: ResourceType;
  operation: OperationType;
  data: T;
  priority: number;
  retryCount: number;
  status: OperationStatus;
  error?: Error;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Base item data for logging - represents a single entry or asset
 */
export interface LogItem {
  uid: string;
  locale: string;
  contentType?: string; // for entries only
  version?: number;
  type: 'entry' | 'asset';
}

/**
 * Log entry for BULK mode operations
 * Stores job_id and batch information for scalability
 */
export interface BulkModeLogEntry {
  mode: 'bulk';
  jobId: string; // Bulk API job ID
  batchNumber?: number; // Batch number for tracking
  operation: 'publish' | 'unpublish';
  timestamp: string;
  environments: string[];
  locales: string[];
  items: LogItem[]; // All items in this bulk job
  status: 'success' | 'failed';
  error?: string;
  // Metadata
  apiKey: string;
  branch?: string;
}

/**
 * Log entry for SINGLE mode operations
 * Stores individual item details
 */
export interface SingleModeLogEntry {
  mode: 'single';
  operation: 'publish' | 'unpublish';
  timestamp: string;
  item: LogItem;
  environments: string[];
  status: 'success' | 'failed';
  error?: string;
  // Metadata
  apiKey: string;
  branch?: string;
}

/**
 * Union type for all log entries
 */
export type LogEntry = BulkModeLogEntry | SingleModeLogEntry;

export interface LogPaths {
  folder: string;
  // Bulk mode logs
  bulkSuccess: string;
  bulkFailed: string;
  // Single mode logs
  singleSuccess: string;
  singleFailed: string;
}

/**
 * Configuration for batch queue listeners
 * Groups all dependencies needed for batch processing
 */
export interface BatchQueueConfig {
  queueManager: any; // QueueManager instance
  bulkService: any; // BulkOperationService instance
  batchResults: Map<string, any>; // BulkJobResult map
  logger: any;
  retryStrategy: any; // RetryStrategy instance
  resourceType: ResourceType;
  logFolderPath?: string;
  apiKey?: string;
  branch?: string;
}

export interface BatchConfig {
  maxItems: number;
  maxLocales: number;
  maxEnvironments: number;
}

export interface BatchedItems {
  items: Array<EntryPublishData | AssetPublishData>;
  environments: string[];
  locales: string[];
  batchNumber: number;
  totalBatches: number;
}

export interface RateLimitConfig {
  maxRequestsPerSecond?: number;
  maxConcurrent?: number;
  burstCapacity?: number;
  adaptiveThrottling?: boolean;
}

export interface RateLimitHeaders {
  limit: string;
  remaining: string;
}

export interface OperationResult {
  success: boolean;
  item: QueueItem;
  response?: any;
  error?: Error;
  duration: number;
}

export interface CrossPublishConfig {
  sourceEnv: string;
  targetEnvs: string[];
  locales: string[];
  contentTypes?: string[];
  resourceType: ResourceType;
  deliveryStack: DeliveryStack | null; // Pass delivery stack from command (optional)
}
