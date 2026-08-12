import { expect } from 'chai';

import { withRetry, RetryableHttpError, isRetryableStatus, parseRetryAfterMs } from '../../../src/utils/retry';

describe('retry', () => {
  describe('isRetryableStatus', () => {
    it('treats 429 and 5xx as retryable, others not', () => {
      expect(isRetryableStatus(429)).to.equal(true);
      expect(isRetryableStatus(500)).to.equal(true);
      expect(isRetryableStatus(503)).to.equal(true);
      expect(isRetryableStatus(404)).to.equal(false);
      expect(isRetryableStatus(400)).to.equal(false);
      expect(isRetryableStatus(200)).to.equal(false);
    });
  });

  describe('parseRetryAfterMs', () => {
    it('parses delta-seconds into ms', () => {
      expect(parseRetryAfterMs('2')).to.equal(2000);
    });

    it('returns undefined for null/empty', () => {
      expect(parseRetryAfterMs(null)).to.equal(undefined);
      expect(parseRetryAfterMs('')).to.equal(undefined);
    });

    it('parses an HTTP date into a non-negative ms delay', () => {
      const value = parseRetryAfterMs(new Date(Date.now() + 1000).toUTCString());
      expect(value).to.be.a('number');
      expect(value as number).to.be.at.least(0);
    });
  });

  describe('withRetry', () => {
    it('returns immediately on success without retrying', async () => {
      let calls = 0;
      const result = await withRetry(
        async () => {
          calls += 1;
          return 'ok';
        },
        { baseDelayMs: 0 },
      );
      expect(result).to.equal('ok');
      expect(calls).to.equal(1);
    });

    it('retries a RetryableHttpError up to `retries` times then rethrows', async () => {
      let calls = 0;
      let error: unknown;
      try {
        await withRetry(
          async () => {
            calls += 1;
            throw new RetryableHttpError('boom', 503);
          },
          { retries: 2, baseDelayMs: 0 },
        );
      } catch (e) {
        error = e;
      }
      expect(calls).to.equal(3); // initial attempt + 2 retries
      expect(error).to.be.instanceOf(RetryableHttpError);
    });

    it('succeeds after transient failures', async () => {
      let calls = 0;
      const result = await withRetry(
        async () => {
          calls += 1;
          if (calls < 3) throw new RetryableHttpError('transient', 500);
          return calls;
        },
        { retries: 5, baseDelayMs: 0 },
      );
      expect(result).to.equal(3);
      expect(calls).to.equal(3);
    });

    it('does NOT retry a non-RetryableHttpError (terminal)', async () => {
      let calls = 0;
      let error: unknown;
      try {
        await withRetry(
          async () => {
            calls += 1;
            throw new Error('terminal');
          },
          { retries: 3, baseDelayMs: 0 },
        );
      } catch (e) {
        error = e;
      }
      expect(calls).to.equal(1);
      expect((error as Error).message).to.equal('terminal');
    });
  });
});
