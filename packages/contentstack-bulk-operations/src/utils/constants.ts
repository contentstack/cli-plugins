/**
 * Rate Limiter Constants
 * Controls the adaptive rate limiting behavior and throttling algorithm
 */
export const RATE_LIMITER_CONSTANTS = {
  // Time windows and intervals
  windowMs: 1000, // Rate limit window (1 second)
  sleepInterval: 50, // Sleep interval for concurrency wait (ms)

  // Capacity and burst handling
  burstCapacity: 20, // Burst capacity for token bucket algorithm

  // Server-side rate limit handling
  serverLimitStaleMs: 5000, // Server limit data staleness (5 seconds)
  serverLimitWaitMs: 1000, // Wait time when server limit exhausted (1 second)

  // Adaptive throttling thresholds
  lowRemainingThreshold: 2, // Threshold for low remaining requests
  lowRemainingPercentage: 0.2, // 20% threshold for rate throttling
  minRatePercentage: 0.1, // Minimum rate (10% of original)

  // Rate adjustment triggers
  successfulRequestsThreshold: 10, // Successful requests before rate increase
  consecutiveErrorsThreshold: 10, // Consecutive errors before circuit breaker

  // Feature flags
  adaptiveThrottling: true, // Enable adaptive throttling by default

  // Timing buffers
  waitTimeBuffer: 10, // Buffer time to avoid race conditions (ms)
} as const;

/**
 * Retry Strategy Constants
 * Exponential backoff algorithm parameters for retrying failed operations
 */
export const RETRY_STRATEGY_CONSTANTS = {
  baseDelay: 1000, // Base delay: 1 second
  maxDelay: 32000, // Max delay: 32 seconds (exponential backoff cap)
  jitterFactor: 0.2, // 20% jitter to prevent thundering herd problem
} as const;

export const BATCH_CONSTANTS = {
  maxItems: 50, // Maximum items per bulk operation (API limit)
  maxLocales: 10, // Maximum locales per bulk operation (API limit)
  maxEnvironments: 10, // Maximum environments per bulk operation (API limit)
  assetFetchBatchSize: 10, // Batch size for fetching assets (performance optimization)
} as const;

export const PAGINATION_CONSTANTS = {
  deliveryApiLimit: 100,
  managementApiLimit: 100,
} as const;

export const API_CONSTANTS = {
  defaultCmaHost: 'api.contentstack.io',
  defaultApiVersion: '3',
} as const;
