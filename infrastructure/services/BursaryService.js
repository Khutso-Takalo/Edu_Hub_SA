/**
 * BursaryService - Advanced search, filtering, and sync operations for bursaries
 * Handles freshness scoring, link health tracking, and multi-device sync
 */

export class BursaryService {
  constructor(bursaryRepository) {
    this.repo = bursaryRepository;
  }

  /**
   * Search bursaries by name, provider, field, or description
   * Returns ranked results by relevance
   */
  async search(query, options = {}) {
    const { limit = 20, minFreshness = 0.4 } = options;
    const allBursaries = await this.repo.getAll();

    if (!query || query.trim() === '') {
      return allBursaries
        .filter(b => (b.freshnessScore || 0) >= minFreshness)
        .sort((a, b) => (b.freshnessScore || 0) - (a.freshnessScore || 0))
        .slice(0, limit);
    }

    const queryLower = query.toLowerCase();
    const scored = allBursaries
      .filter(b => (b.freshnessScore || 0) >= minFreshness)
      .map(bursary => {
        let score = 0;
        const fields = [bursary.name, bursary.provider, bursary.field, bursary.description];

        // Name match: highest priority
        if (bursary.name.toLowerCase().includes(queryLower)) {
          score += 3;
        }

        // Provider match
        if (bursary.provider.toLowerCase().includes(queryLower)) {
          score += 2;
        }

        // Field or description match
        fields.forEach(field => {
          if (field && field.toLowerCase().includes(queryLower)) {
            score += 1;
          }
        });

        // Boost recently verified bursaries
        const freshness = bursary.freshnessScore || 0;
        score *= (1 + freshness * 0.5);

        return { ...bursary, relevanceScore: score };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return scored.map(({ relevanceScore, ...b }) => b);
  }

  /**
   * Filter bursaries by multiple criteria
   */
  async filter(criteria = {}) {
    const {
      field,
      province,
      minAPS,
      maxAPS,
      deadlineBefore,
      deadlineAfter,
      verificationStatus,
      minFreshness = 0.4,
    } = criteria;

    let results = await this.repo.getAll();

    // Exclude quarantined bursaries
    results = results.filter(b => !b.quarantineReason);

    // Filter by freshness
    results = results.filter(b => (b.freshnessScore || 0) >= minFreshness);

    // Filter by field
    if (field) {
      results = results.filter(b => b.field === field || b.field === 'All Fields');
    }

    // Filter by province eligibility
    if (province) {
      results = results.filter(b => {
        if (!b.provinceEligibility) return true; // No restriction
        return b.provinceEligibility.includes(province);
      });
    }

    // Filter by APS range
    if (minAPS !== undefined) {
      results = results.filter(b => {
        const bursaryMinAPS = b.minAPS || 0;
        return bursaryMinAPS <= minAPS;
      });
    }

    if (maxAPS !== undefined) {
      results = results.filter(b => {
        const bursaryMinAPS = b.minAPS || 0;
        return bursaryMinAPS <= maxAPS;
      });
    }

    // Filter by deadline
    if (deadlineBefore) {
      results = results.filter(b => new Date(b.deadline) <= new Date(deadlineBefore));
    }

    if (deadlineAfter) {
      results = results.filter(b => new Date(b.deadline) >= new Date(deadlineAfter));
    }

    // Filter by verification status
    if (verificationStatus) {
      results = results.filter(b => b.verificationStatus === verificationStatus);
    }

    // Sort by deadline proximity
    return results.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  /**
   * Get upcoming deadlines (within N days)
   */
  async getUpcomingDeadlines(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);

    const upcoming = await this.repo.getAll();
    return upcoming
      .filter(b => {
        const deadline = new Date(b.deadline);
        return deadline > new Date() && deadline <= cutoffDate;
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }

  /**
   * Calculate freshness score based on last verification
   */
  calculateFreshnessScore(lastVerified) {
    if (!lastVerified) return 0;

    const verifiedDate = new Date(lastVerified);
    const now = new Date();
    const daysSinceVerified = (now - verifiedDate) / (1000 * 60 * 60 * 24);

    // Linear decay: 1.0 at 0 days, 0.5 at 30 days, 0.0 at 60+ days
    const score = Math.max(0, 1 - daysSinceVerified / 60);
    return Math.round(score * 100) / 100;
  }

  /**
   * Update bursary with new verification data
   */
  async updateVerification(bursaryId, verificationData) {
    const now = new Date().toISOString();
    const freshnessScore = this.calculateFreshnessScore(now);

    return this.repo.update(bursaryId, {
      ...verificationData,
      freshnessScore,
      lastVerified: now,
    });
  }

  /**
   * Mark link as broken (increments check count, quarantines if threshold reached)
   */
  async reportBrokenLink(bursaryId, options = {}) {
    const { automaticQuarantine = false, maxConsecutiveChecks = 3 } = options;
    const bursary = await this.repo.getById(bursaryId);

    if (!bursary) throw new Error(`Bursary ${bursaryId} not found`);

    const checks = (bursary.consecutiveBrokenChecks || 0) + 1;
    let updates = { consecutiveBrokenChecks: checks, linkHealthStatus: 'broken' };

    // Auto-quarantine after N consecutive failures
    if (automaticQuarantine && checks >= maxConsecutiveChecks) {
      updates.quarantineReason = `Link broken in ${checks} consecutive checks`;
    }

    return this.repo.update(bursaryId, updates);
  }

  /**
   * Mark link as healthy (resets broken check count)
   */
  async reportHealthyLink(bursaryId) {
    return this.repo.update(bursaryId, {
      linkHealthStatus: 'healthy',
      consecutiveBrokenChecks: 0,
    });
  }

  /**
   * Get bursaries grouped by field
   */
  async getByField(field) {
    const allBursaries = await this.repo.getAll();
    return allBursaries.filter(b => b.field === field);
  }

  /**
   * Get golden bursaries (high-value or prestigious)
   */
  async getGoldenBursaries() {
    const allBursaries = await this.repo.getAll();
    return allBursaries
      .filter(b => b.isGolden === true && !b.quarantineReason)
      .sort((a, b) => (b.freshnessScore || 0) - (a.freshnessScore || 0));
  }

  /**
   * Get stats for dashboard
   */
  async getStats() {
    const allBursaries = await this.repo.getAll();
    const active = allBursaries.filter(b => !b.quarantineReason);
    const verified = active.filter(b => b.verificationStatus === 'verified');
    const fieldCounts = {};

    allBursaries.forEach(b => {
      fieldCounts[b.field] = (fieldCounts[b.field] || 0) + 1;
    });

    return {
      total: allBursaries.length,
      active: active.length,
      verified: verified.length,
      verificationRate: active.length > 0 ? (verified.length / active.length).toFixed(2) : 0,
      byField: fieldCounts,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export default BursaryService;
