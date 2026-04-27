import type { Bursary } from '@/data/staticData';

export type TrustTier = 'official' | 'admin-verified' | 'community-confirmed' | 'unverified';

export const TRUST_TIER_LABELS: Record<TrustTier, string> = {
  official: 'Official',
  'admin-verified': 'Admin Verified',
  'community-confirmed': 'Community Confirmed',
  unverified: 'Unverified',
};

export const FRESHNESS_DECAY_PER_DAY = 2;
export const FRESHNESS_AUTO_HIDE_THRESHOLD = 20;

export function computeFreshnessScore(lastVerified?: string, now = Date.now()): number {
  if (!lastVerified) return 0;

  const verifiedAt = new Date(lastVerified).getTime();
  if (!Number.isFinite(verifiedAt)) return 0;

  const elapsedDays = Math.max(0, Math.floor((now - verifiedAt) / (24 * 60 * 60 * 1000)));
  const decayed = 100 - elapsedDays * FRESHNESS_DECAY_PER_DAY;
  return Math.max(0, Math.min(100, decayed));
}

export function shouldAutoHideByFreshness(score: number): boolean {
  return score < FRESHNESS_AUTO_HIDE_THRESHOLD;
}

export function inferTrustTier(options: {
  sourceUrl?: string;
  verificationSource?: Bursary['verificationSource'];
  communityVotes?: number;
  adminVerified?: boolean;
}): TrustTier {
  const { sourceUrl, verificationSource, communityVotes = 0, adminVerified = false } = options;

  if (sourceUrl && /\.gov\.za(\/|$)/i.test(sourceUrl)) return 'official';
  if (verificationSource === 'official') return 'official';
  if (adminVerified || verificationSource === 'scraped') return 'admin-verified';
  if (communityVotes >= 3) return 'community-confirmed';
  return 'unverified';
}

export function computeDemandScore(input: {
  dhetAlignment: number;
  criticalSkillsAlignment: number;
  jobVolumeSignal: number;
}): number {
  const dhet = clamp01(input.dhetAlignment);
  const critical = clamp01(input.criticalSkillsAlignment);
  const jobs = clamp01(input.jobVolumeSignal);

  const weighted = dhet * 0.4 + critical * 0.3 + jobs * 0.3;
  return Math.round(weighted * 5 * 10) / 10;
}

export function detectScamSignals(payload: {
  text: string;
  sourceUrl?: string;
}): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const text = payload.text.toLowerCase();

  const riskyPhrases = [
    'guaranteed job',
    'pay for registration',
    'processing fee required',
    'send money first',
    'limited slots pay now',
  ];

  for (const phrase of riskyPhrases) {
    if (text.includes(phrase)) reasons.push(`Contains risky phrase: ${phrase}`);
  }

  if (payload.sourceUrl) {
    try {
      const hostname = new URL(payload.sourceUrl).hostname.toLowerCase();
      const trustedTlds = ['.gov.za', '.ac.za', '.org.za', '.co.za', '.com'];
      if (!trustedTlds.some((suffix) => hostname.endsWith(suffix))) {
        reasons.push('Source domain is non-standard or low-trust');
      }
    } catch {
      reasons.push('Source URL is invalid');
    }
  }

  return { suspicious: reasons.length > 0, reasons };
}

export function detectAnomalyZScore(values: number[], candidate: number, threshold = 3): boolean {
  if (values.length < 3) return false;

  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return false;

  const zScore = Math.abs((candidate - mean) / stdDev);
  return zScore >= threshold;
}

export function computeCompleteness<T extends Record<string, unknown>>(
  rows: T[],
  requiredFields: Array<keyof T>
): { completenessPct: number; missingFieldCounts: Record<string, number> } {
  if (rows.length === 0) {
    return { completenessPct: 100, missingFieldCounts: {} };
  }

  const missingFieldCounts: Record<string, number> = {};
  let completeRows = 0;

  for (const row of rows) {
    let missing = 0;

    for (const field of requiredFields) {
      const value = row[field];
      const missingValue =
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0);

      if (missingValue) {
        missing += 1;
        const key = String(field);
        missingFieldCounts[key] = (missingFieldCounts[key] || 0) + 1;
      }
    }

    if (missing === 0) completeRows += 1;
  }

  return {
    completenessPct: Math.round((completeRows / rows.length) * 1000) / 10,
    missingFieldCounts,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
