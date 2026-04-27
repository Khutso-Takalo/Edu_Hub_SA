/**
 * VerificationService - Periodic link health checks and data freshness verification
 * Runs background verification cycles to ensure bursary data remains current and accurate
 */

export class VerificationService {
  constructor(bursaryService, logger = console) {
    this.bursaryService = bursaryService;
    this.logger = logger;
    this.verificationInterval = null;
    this.isRunning = false;
    this.stats = {
      total: 0,
      checked: 0,
      healthy: 0,
      broken: 0,
      lastCheck: null,
    };
  }

  /**
   * Start periodic background verification
   * Checks a subset of bursaries every interval
   */
  startPeriodicVerification(intervalMinutes = 60, batchSize = 10) {
    if (this.isRunning) {
      this.logger.warn('Verification already running');
      return false;
    }

    this.isRunning = true;
    this.logger.info(`Starting periodic verification every ${intervalMinutes} minutes`);

    this.verificationInterval = setInterval(() => {
      this.runVerificationCycle(batchSize).catch(error => {
        this.logger.error('Verification cycle failed:', error);
      });
    }, intervalMinutes * 60 * 1000);

    // Run first check immediately
    this.runVerificationCycle(batchSize);

    return true;
  }

  /**
   * Stop periodic verification
   */
  stopPeriodicVerification() {
    if (this.verificationInterval) {
      clearInterval(this.verificationInterval);
      this.verificationInterval = null;
      this.isRunning = false;
      this.logger.info('Stopped periodic verification');
      return true;
    }
    return false;
  }

  /**
   * Run a single verification cycle
   * Prioritizes bursaries with stale freshness scores
   */
  async runVerificationCycle(batchSize = 10) {
    try {
      const allBursaries = (await this.bursaryService.repo.getAll()) || [];
      this.stats.total = allBursaries.length;

      // Select oldest/stalest bursaries to verify
      const batch = allBursaries
        .sort((a, b) => {
          const freshA = a.freshnessScore || 0;
          const freshB = b.freshnessScore || 0;
          return freshA - freshB; // Oldest first
        })
        .slice(0, batchSize);

      this.logger.info(`Verification cycle: checking ${batch.length}/${allBursaries.length} bursaries`);

      let healthy = 0;
      let broken = 0;

      for (const bursary of batch) {
        try {
          const isHealthy = await this.verifyBursaryLink(bursary);

          if (isHealthy) {
            await this.bursaryService.reportHealthyLink(bursary.id);
            healthy++;
          } else {
            await this.bursaryService.reportBrokenLink(bursary.id);
            broken++;
          }

          this.stats.checked++;
        } catch (error) {
          this.logger.error(`Verification failed for bursary ${bursary.id}:`, error);
        }
      }

      this.stats.healthy = healthy;
      this.stats.broken = broken;
      this.stats.lastCheck = new Date().toISOString();

      this.logger.info(`Verification cycle complete: ${healthy} healthy, ${broken} broken`);
    } catch (error) {
      this.logger.error('Verification cycle error:', error);
    }
  }

  /**
   * Verify a single bursary link is accessible
   */
  async verifyBursaryLink(bursary, timeout = 10000) {
    try {
      // Skip if no link or link is placeholder
      if (!bursary.link || bursary.link === '#') {
        return true; // Assume healthy if no link to verify
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(bursary.link, {
          method: 'HEAD',
          signal: controller.signal,
          redirect: 'follow',
          mode: 'no-cors',
        });

        clearTimeout(timeoutId);

        // 2xx or 3xx status codes are considered healthy
        const isHealthy = response.status >= 200 && response.status < 400;
        this.logger.debug(`${bursary.name}: ${response.status} ${isHealthy ? '✓' : '✗'}`);

        return isHealthy;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          this.logger.warn(`${bursary.name}: verification timeout`);
          return false; // Timeout = broken
        }

        // Network error, CORS issue, or other error
        this.logger.warn(`${bursary.name}: verification error: ${fetchError.message}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Unexpected error verifying ${bursary.id}:`, error);
      return false;
    }
  }

  /**
   * Verify multiple bursaries in parallel
   * Useful for bulk verification operations
   */
  async verifyBatch(bursaries, maxConcurrent = 5, timeout = 10000) {
    const results = [];
    const queue = [...bursaries];
    let running = [];

    while (queue.length > 0 || running.length > 0) {
      // Start new verifications up to max concurrent
      while (running.length < maxConcurrent && queue.length > 0) {
        const bursary = queue.shift();
        const promise = this.verifyBursaryLink(bursary, timeout)
          .then(isHealthy => ({
            id: bursary.id,
            name: bursary.name,
            isHealthy,
            timestamp: new Date().toISOString(),
          }))
          .catch(error => ({
            id: bursary.id,
            name: bursary.name,
            isHealthy: false,
            error: error.message,
            timestamp: new Date().toISOString(),
          }));

        running.push(promise);
      }

      // Wait for first result and collect it
      if (running.length > 0) {
        const result = await Promise.race(running);
        results.push(result);
        running = running.filter(p => p !== running[0]); // Remove completed promise
      }
    }

    return results;
  }

  /**
   * Get verification statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      healthRate: this.stats.checked > 0
        ? ((this.stats.healthy / this.stats.checked) * 100).toFixed(1) + '%'
        : 'N/A',
    };
  }

  /**
   * Calculate data freshness score for all bursaries
   * Older data (not recently verified) gets lower scores
   */
  async updateFreshnessScores() {
    try {
      const allBursaries = await this.bursaryService.repo.getAll();
      let updated = 0;

      for (const bursary of allBursaries) {
        const newScore = this.bursaryService.calculateFreshnessScore(bursary.lastVerified);

        if (newScore !== bursary.freshnessScore) {
          await this.bursaryService.repo.update(bursary.id, {
            freshnessScore: newScore,
          });
          updated++;
        }
      }

      this.logger.info(`Updated freshness scores for ${updated} bursaries`);
      return updated;
    } catch (error) {
      this.logger.error('Failed to update freshness scores:', error);
      return 0;
    }
  }

  /**
   * Get bursaries that need urgent verification (freshness < threshold)
   */
  async getNeedsVerification(freshnessThreshold = 0.3) {
    const allBursaries = await this.bursaryService.repo.getAll();

    return allBursaries
      .filter(b => (b.freshnessScore || 0) < freshnessThreshold)
      .sort((a, b) => (a.freshnessScore || 0) - (b.freshnessScore || 0));
  }

  /**
   * Manual verification trigger for specific bursaries
   */
  async verifySpecific(bursaryIds) {
    this.logger.info(`Manual verification triggered for ${bursaryIds.length} bursaries`);

    const results = [];

    for (const id of bursaryIds) {
      try {
        const bursary = await this.bursaryService.repo.getById(id);

        if (!bursary) {
          results.push({ id, error: 'Bursary not found' });
          continue;
        }

        const isHealthy = await this.verifyBursaryLink(bursary);

        if (isHealthy) {
          await this.bursaryService.reportHealthyLink(id);
        } else {
          await this.bursaryService.reportBrokenLink(id);
        }

        results.push({ id, isHealthy, timestamp: new Date().toISOString() });
      } catch (error) {
        results.push({ id, error: error.message });
      }
    }

    return results;
  }
}

export default VerificationService;
