const config = {
  // Bulk job polling configuration
  pollInterval: 2000, // Polling interval in milliseconds (2 seconds)
  maxPolls: 300, // Maximum number of polls (300 × 2s = ~1 minute)

  // Rate limiter configuration - values users might tune based on their API limits
  rateLimit: {
    maxRequestsPerSecond: 10, // Default max requests per second
    maxConcurrent: 5, // Default concurrent requests
  },

  retry: {
    maxRetries: 5, // Default maximum retries
  },
};

export default config;
