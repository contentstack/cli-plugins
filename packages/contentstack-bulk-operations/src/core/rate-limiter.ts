import chalk from 'chalk';
import defaultConfig from '../config';
import { RATE_LIMITER_CONSTANTS } from '../utils';
import { RateLimitConfig, RateLimitHeaders } from '../interfaces';
import messages, { $t } from '../messages';

export class AdaptiveRateLimiter {
  private tokens: number;
  private lastRefill: number;
  private recentRequests: number[] = [];
  private activeRequests: number = 0;
  private windowMs: number = RATE_LIMITER_CONSTANTS.windowMs;
  private consecutiveErrors: number = 0;
  private currentRate: number;
  private readonly config: Required<RateLimitConfig>;
  private readonly originalRate: number;

  private readonly headerNames: RateLimitHeaders;

  private serverLimits: {
    limit: number;
    remaining: number;
    lastUpdated: number;
  } | null = null;

  // Metrics for monitoring
  private metrics = {
    totalRequests: 0,
    rateLimitHits: 0,
    throttleAdjustments: 0,
    successfulRequests: 0, // Track for gradual rate increase
    headerBasedThrottles: 0, // Track proactive throttling from headers
  };

  constructor(config: Partial<RateLimitConfig> = {}, headers?: RateLimitHeaders) {
    this.config = {
      maxRequestsPerSecond: config.maxRequestsPerSecond ?? defaultConfig.rateLimit.maxRequestsPerSecond,
      maxConcurrent: config.maxConcurrent ?? defaultConfig.rateLimit.maxConcurrent,
      burstCapacity: config.burstCapacity ?? RATE_LIMITER_CONSTANTS.burstCapacity,
      adaptiveThrottling: config.adaptiveThrottling ?? RATE_LIMITER_CONSTANTS.adaptiveThrottling,
    };

    // Use provided headers or default to Contentstack headers
    this.headerNames = headers ?? {
      limit: 'x-ratelimit-limit',
      remaining: 'x-ratelimit-remaining',
    };

    this.tokens = this.config.burstCapacity;
    this.currentRate = this.config.maxRequestsPerSecond;
    this.originalRate = this.config.maxRequestsPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<RateLimitToken> {
    // Check server-side rate limits first (from response headers)
    const serverWait = this.checkServerRateLimit();
    if (serverWait > 0) {
      console.log(chalk.yellow($t(messages.RATE_LIMIT_SERVER_WAIT, { seconds: Math.ceil(serverWait / 1000) })));
      await this.sleep(serverWait);
      this.serverLimits = null; // Clear after waiting
    }

    // Wait for concurrent slot
    while (this.activeRequests >= this.config.maxConcurrent) {
      await this.sleep(RATE_LIMITER_CONSTANTS.sleepInterval);
    }

    this.refillTokens();

    this.cleanOldRequests();

    // Check if we're at rate limit
    if (this.recentRequests.length >= this.currentRate) {
      const waitTime = this.calculateWaitTime();
      await this.sleep(waitTime);
      return this.acquire(); // Retry after waiting
    }

    // Wait for token if needed
    while (this.tokens < 1) {
      const refillWait = 1000 / this.currentRate;
      await this.sleep(refillWait);
      this.refillTokens();
    }

    // Consume token and track request
    this.tokens -= 1;
    this.activeRequests++;
    this.recentRequests.push(Date.now());
    this.metrics.totalRequests++;

    return new RateLimitToken(this);
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.currentRate;

    this.tokens = Math.min(this.config.burstCapacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private cleanOldRequests(): void {
    const now = Date.now();
    this.recentRequests = this.recentRequests.filter((time) => now - time < this.windowMs);
  }

  private calculateWaitTime(): number {
    if (this.recentRequests.length === 0) return 0;

    const now = Date.now();
    const oldestRequest = this.recentRequests[0];
    return Math.max(0, this.windowMs - (now - oldestRequest) + RATE_LIMITER_CONSTANTS.waitTimeBuffer);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if we should wait based on server-side rate limit headers
   * Returns wait time in milliseconds, or 0 if no wait needed
   */
  private checkServerRateLimit(): number {
    if (!this.serverLimits) return 0;

    const now = Date.now();

    // Check if server limit data is stale
    if (now - this.serverLimits.lastUpdated > RATE_LIMITER_CONSTANTS.serverLimitStaleMs) {
      this.serverLimits = null;
      return 0;
    }

    // If server says we have 0 remaining, wait before retrying
    if (this.serverLimits.remaining === 0) {
      return RATE_LIMITER_CONSTANTS.serverLimitWaitMs;
    }

    return 0;
  }

  /**
   * Update rate limiter based on response headers from API
   * Call this after every API response (success or error)
   *
   * Contentstack provides only 2 headers:
   * - x-ratelimit-limit: Maximum requests per second
   * - x-ratelimit-remaining: Remaining requests in current window
   */
  updateFromHeaders(headers: any): void {
    if (!headers) return;

    const limit = this.parseHeader(headers[this.headerNames.limit]);
    const remaining = this.parseHeader(headers[this.headerNames.remaining]);

    if (remaining === null) return;

    this.serverLimits = {
      limit: limit || this.config.maxRequestsPerSecond,
      remaining,
      lastUpdated: Date.now(),
    };

    // Proactive throttling if remaining is critically low
    if (remaining <= RATE_LIMITER_CONSTANTS.lowRemainingThreshold && this.config.adaptiveThrottling) {
      const percentageRemaining = remaining / (limit || this.config.maxRequestsPerSecond);

      if (percentageRemaining < RATE_LIMITER_CONSTANTS.lowRemainingPercentage) {
        // Less than configured percentage remaining
        const previousRate = this.currentRate;
        const minRate = this.originalRate * RATE_LIMITER_CONSTANTS.minRatePercentage;

        // More aggressive throttling when very low
        this.currentRate = Math.max(
          minRate,
          this.currentRate * 0.4 // 60% reduction
        );

        if (previousRate !== this.currentRate) {
          this.metrics.throttleAdjustments++;
          this.metrics.headerBasedThrottles++;
          console.log(
            chalk.yellow(
              $t(messages.RATE_LIMIT_LOW_REMAINING, {
                remaining,
                limit: limit || 'unknown',
                rate: this.currentRate.toFixed(2),
              })
            )
          );
        }
      }
    }

    // Log if we're getting close to limit (for monitoring)
    if (remaining <= 5 && remaining > 0) {
      console.log(chalk.cyan($t(messages.RATE_LIMIT_WARNING, { remaining, limit: limit || 'unknown' })));
    }
  }

  /**
   * Parse rate limit header value to number
   */
  private parseHeader(value: any): number | null {
    if (value === undefined || value === null) return null;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? null : parsed;
  }

  release(): void {
    this.activeRequests--;
  }

  recordSuccess(): void {
    this.consecutiveErrors = 0;
    this.metrics.successfulRequests++;

    if (!this.config.adaptiveThrottling) return;

    // Gradual rate increase after configured successful requests
    if (
      this.metrics.successfulRequests % RATE_LIMITER_CONSTANTS.successfulRequestsThreshold === 0 &&
      this.currentRate < this.originalRate
    ) {
      const previousRate = this.currentRate;
      this.currentRate = Math.min(this.originalRate, this.currentRate * 1.05);

      if (previousRate !== this.currentRate) {
        this.metrics.throttleAdjustments++;
        console.log(
          chalk.green(
            $t(messages.RATE_LIMIT_INCREASED, {
              rate: this.currentRate.toFixed(2),
              successes: this.metrics.successfulRequests,
            })
          )
        );
      }
    }
  }

  recordFailure(is429: boolean = false): void {
    if (is429) {
      this.metrics.rateLimitHits++;
      this.consecutiveErrors++;

      if (!this.config.adaptiveThrottling) return;

      // Reduce rate by 30%
      const previousRate = this.currentRate;
      const minRate = this.originalRate * RATE_LIMITER_CONSTANTS.minRatePercentage;

      this.currentRate = Math.max(
        minRate,
        this.currentRate * 0.7 // 30% reduction
      );

      if (previousRate !== this.currentRate) {
        this.metrics.throttleAdjustments++;
        console.log(
          chalk.yellow(
            $t(messages.RATE_LIMIT_THROTTLED, {
              rate: this.currentRate.toFixed(2),
              avgRate: this.consecutiveErrors,
            })
          )
        );
      }

      // Circuit breaker check
      if (this.consecutiveErrors >= RATE_LIMITER_CONSTANTS.consecutiveErrorsThreshold) {
        this.currentRate = Math.max(minRate, this.currentRate * 0.5);
        console.log(
          chalk.red(
            $t(messages.RATE_LIMIT_CIRCUIT_BREAKER, {
              rate: this.currentRate.toFixed(2),
              errors: this.consecutiveErrors,
            })
          )
        );
      }
    } else {
      this.consecutiveErrors++;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      currentRate: this.currentRate,
      activeRequests: this.activeRequests,
      availableTokens: Math.floor(this.tokens),
      serverLimitRemaining: this.serverLimits?.remaining ?? null,
    };
  }

  reset(): void {
    this.currentRate = this.originalRate;
    this.consecutiveErrors = 0;
    this.tokens = this.config.burstCapacity;
    this.recentRequests = [];
    console.log(chalk.green(`✓ ${$t(messages.RATE_LIMIT_RESET, { rate: this.originalRate })}`));
  }
}

export class RateLimitToken {
  constructor(private limiter: AdaptiveRateLimiter) {}

  release(): void {
    this.limiter.release();
  }

  success(responseHeaders?: any): void {
    // Update from headers if provided
    if (responseHeaders) {
      this.limiter.updateFromHeaders(responseHeaders);
    }
    this.limiter.recordSuccess();
  }

  failure(is429: boolean = false, responseHeaders?: any): void {
    // Update from headers even on failure (especially important for 429s)
    if (responseHeaders) {
      this.limiter.updateFromHeaders(responseHeaders);
    }
    this.limiter.recordFailure(is429);
  }
}
