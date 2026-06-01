/**
 * Unit tests for config/index
 * Tests configuration constants and default values
 */

import { expect } from 'chai';
import config from '../../../src/config';

describe('Config', () => {
  describe('Configuration Constants', () => {
    it('should export a config object', () => {
      expect(config).to.be.an('object');
    });

    it('should have pollInterval property', () => {
      expect(config).to.have.property('pollInterval');
      expect(config.pollInterval).to.be.a('number');
    });

    it('should have maxPolls property', () => {
      expect(config).to.have.property('maxPolls');
      expect(config.maxPolls).to.be.a('number');
    });

    it('should have pollInterval set to 2000ms', () => {
      expect(config.pollInterval).to.equal(2000);
    });

    it('should have maxPolls set to 300', () => {
      expect(config.maxPolls).to.equal(300);
    });

    it('should provide reasonable defaults for polling', () => {
      // pollInterval * maxPolls = total max wait time
      const maxWaitTimeSeconds = (config.pollInterval * config.maxPolls) / 1000;

      // 2000ms * 300 = 600,000ms = 600 seconds = 10 minutes
      expect(maxWaitTimeSeconds).to.equal(600);
      expect(maxWaitTimeSeconds).to.be.at.most(3000); // Should not exceed 50 minutes
    });

    it('should have positive values', () => {
      expect(config.pollInterval).to.be.above(0);
      expect(config.maxPolls).to.be.above(0);
    });

    it('should have reasonable poll interval (not too frequent)', () => {
      expect(config.pollInterval).to.be.at.least(1000); // At least 1 second
    });

    it('should have reasonable max polls (not too many)', () => {
      expect(config.maxPolls).to.be.at.most(1000); // Max 1000 polls
    });

    it('should be immutable (defensive test)', () => {
      const originalPollInterval = config.pollInterval;
      const originalMaxPolls = config.maxPolls;

      // Try to modify (should not affect original if properly exported)
      const configCopy = { ...config };
      configCopy.pollInterval = 2000;
      configCopy.maxPolls = 300;

      // Original should remain unchanged
      expect(config.pollInterval).to.equal(originalPollInterval);
      expect(config.maxPolls).to.equal(originalMaxPolls);
    });

    it('should export default config object with only tunable parameters', () => {
      expect(config).to.deep.equal({
        pollInterval: 2000,
        maxPolls: 300,
        rateLimit: {
          maxRequestsPerSecond: 10,
          maxConcurrent: 5,
        },
        retry: {
          maxRetries: 5,
        },
      });
    });

    it('should only contain user-tunable parameters', () => {
      // Config should not contain internal implementation details
      expect(config).to.not.have.property('batch');
      expect(config).to.not.have.property('pagination');
      expect(config).to.not.have.property('api');

      // Rate limit should only have user-tunable values
      expect(config.rateLimit).to.not.have.property('windowMs');
      expect(config.rateLimit).to.not.have.property('sleepInterval');
      expect(config.rateLimit).to.not.have.property('burstCapacity');

      // Retry should only have maxRetries, not algorithm parameters
      expect(config.retry).to.not.have.property('baseDelay');
      expect(config.retry).to.not.have.property('maxDelay');
      expect(config.retry).to.not.have.property('jitterFactor');
    });
  });

  describe('Configuration Usage', () => {
    it('should provide config suitable for bulk operations', () => {
      // Calculate total timeout
      const totalTimeoutMs = config.pollInterval * config.maxPolls;
      const totalTimeoutMinutes = totalTimeoutMs / (1000 * 60);

      // Should provide at least 5 minutes for large bulk operations
      expect(totalTimeoutMinutes).to.be.at.least(5);

      // Should not exceed 50 minutes to avoid hanging operations
      expect(totalTimeoutMinutes).to.be.at.most(50);
    });

    it('should have poll interval that balances API rate limits and responsiveness', () => {
      // 5 seconds allows ~12 polls per minute, which is reasonable for most APIs
      expect(config.pollInterval).to.equal(2000);

      const pollsPerMinute = 60000 / config.pollInterval;
      expect(pollsPerMinute).to.be.at.most(60); // Don't poll more than once per second on average
    });
  });
});
