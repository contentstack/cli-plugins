import config from '../config';
import { RETRY_STRATEGY_CONSTANTS } from '../utils';
import { QueueItem } from '../interfaces';

export class RetryStrategy {
  public readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly jitterFactor: number;

  // Error codes that should trigger retry
  private readonly retryableErrorCodes = [429, 500, 502, 503, 504, 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];

  constructor(
    maxRetries: number = config.retry.maxRetries,
    baseDelay: number = RETRY_STRATEGY_CONSTANTS.baseDelay,
    maxDelay: number = RETRY_STRATEGY_CONSTANTS.maxDelay,
    jitterFactor: number = RETRY_STRATEGY_CONSTANTS.jitterFactor
  ) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.jitterFactor = jitterFactor;
  }

  async shouldRetry(item: QueueItem, error: any): Promise<boolean> {
    if (item.retryCount >= this.maxRetries) {
      return false;
    }

    if (!error) {
      return false;
    }

    const errorCode = error.errorCode || error.status || error.code;
    return this.retryableErrorCodes.includes(errorCode);
  }

  getDelay(retryCount: number): number {
    // Exponential backoff: baseDelay * 2^retryCount
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter to prevent thundering herd
    // Jitter range: ±(delay × jitterFactor)
    const jitterRange = cappedDelay * this.jitterFactor;
    const jitter = (Math.random() * 2 - 1) * jitterRange;

    return Math.floor(cappedDelay + jitter);
  }

  // For 429 specifically, use a more aggressive backoff
  getRateLimitDelay(retryCount: number): number {
    const aggressiveDelay = this.getDelay(retryCount) * 1.5;
    return Math.min(aggressiveDelay, this.maxDelay);
  }
}
