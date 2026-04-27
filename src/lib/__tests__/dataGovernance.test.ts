import { describe, expect, it } from 'vitest';
import {
  computeDemandScore,
  computeFreshnessScore,
  detectAnomalyZScore,
  detectScamSignals,
  inferTrustTier,
  shouldAutoHideByFreshness,
} from '@/lib/dataGovernance';

describe('dataGovernance', () => {
  it('computes freshness decay and auto-hide threshold', () => {
    const now = new Date('2026-04-16T00:00:00.000Z').getTime();
    const score = computeFreshnessScore('2026-04-06T00:00:00.000Z', now);

    expect(score).toBe(80);
    expect(shouldAutoHideByFreshness(score)).toBe(false);
    expect(shouldAutoHideByFreshness(19)).toBe(true);
  });

  it('infers trust tiers from source and verification', () => {
    expect(inferTrustTier({ sourceUrl: 'https://www.dhet.gov.za/opps' })).toBe('official');
    expect(inferTrustTier({ verificationSource: 'scraped' })).toBe('admin-verified');
    expect(inferTrustTier({ communityVotes: 3 })).toBe('community-confirmed');
    expect(inferTrustTier({})).toBe('unverified');
  });

  it('flags suspicious language and odd domains', () => {
    const result = detectScamSignals({
      text: 'Guaranteed job. Pay for registration now!',
      sourceUrl: 'https://fake-bursary.xyz',
    });

    expect(result.suspicious).toBe(true);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('computes demand score and anomaly signal', () => {
    const demand = computeDemandScore({
      dhetAlignment: 1,
      criticalSkillsAlignment: 0.6,
      jobVolumeSignal: 0.8,
    });

    expect(demand).toBeGreaterThan(0);
    expect(demand).toBeLessThanOrEqual(5);

    const anomaly = detectAnomalyZScore([100, 102, 99, 101, 100], 300);
    expect(anomaly).toBe(true);
  });
});
