import type { Bursary } from '@/data/staticData';
import { hasValidExternalUrl } from '@/lib/dataQuality';
import {
  computeCompleteness,
  computeFreshnessScore,
  inferTrustTier,
  shouldAutoHideByFreshness,
  type TrustTier,
} from '@/lib/dataGovernance';

export interface ScraperHeartbeat {
  sourceId: string;
  runAt: string;
  success: boolean;
  rowsScraped: number;
  errorMessage?: string;
}

export interface ScraperHeartbeatStatus {
  sourceId: string;
  status: 'healthy' | 'warning' | 'critical';
  reasons: string[];
}

export function evaluateScraperHeartbeat(runs: ScraperHeartbeat[]): ScraperHeartbeatStatus[] {
  const grouped = new Map<string, ScraperHeartbeat[]>();

  for (const run of runs) {
    const bucket = grouped.get(run.sourceId) || [];
    bucket.push(run);
    grouped.set(run.sourceId, bucket);
  }

  return [...grouped.entries()].map(([sourceId, sourceRuns]) => {
    const sorted = [...sourceRuns].sort((a, b) => new Date(b.runAt).getTime() - new Date(a.runAt).getTime());
    const recent = sorted.slice(0, 3);
    const reasons: string[] = [];

    const consecutiveFailures = recent.filter((run) => !run.success).length;
    if (consecutiveFailures >= 2) reasons.push('Two or more consecutive failures detected');

    if (recent.length >= 2) {
      const latest = recent[0].rowsScraped;
      const previousAvg = recent.slice(1).reduce((acc, item) => acc + item.rowsScraped, 0) / (recent.length - 1);
      if (previousAvg > 0 && latest < previousAvg * 0.5) {
        reasons.push('Row volume dropped by more than 50%');
      }
    }

    const status: ScraperHeartbeatStatus['status'] =
      reasons.length === 0 ? 'healthy' : reasons.length === 1 ? 'warning' : 'critical';

    return { sourceId, status, reasons };
  });
}

export function buildBursaryQualitySnapshot(bursaries: Bursary[]) {
  const freshness = bursaries.map((item) => item.freshnessScore ?? computeFreshnessScore(item.lastVerified));
  const averageFreshness = freshness.length
    ? Math.round((freshness.reduce((acc, value) => acc + value, 0) / freshness.length) * 10) / 10
    : 0;

  const autoHiddenCount = freshness.filter((score) => shouldAutoHideByFreshness(score)).length;
  const brokenLinks = bursaries.filter((item) => !hasValidExternalUrl(item.link)).length;

  const trustCounts: Record<TrustTier, number> = {
    official: 0,
    'admin-verified': 0,
    'community-confirmed': 0,
    unverified: 0,
  };

  for (const bursary of bursaries) {
    const trust = inferTrustTier({
      sourceUrl: bursary.link,
      verificationSource: bursary.verificationSource,
    });
    trustCounts[trust] += 1;
  }

  const completeness = computeCompleteness(bursaries, ['id', 'name', 'provider', 'deadline', 'link', 'eligibility']);

  return {
    total: bursaries.length,
    averageFreshness,
    autoHiddenCount,
    brokenLinks,
    trustCounts,
    completenessPct: completeness.completenessPct,
    missingFieldCounts: completeness.missingFieldCounts,
  };
}
