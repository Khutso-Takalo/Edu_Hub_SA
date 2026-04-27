import { z } from 'zod';

const BursaryIngestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  provider: z.string().min(2),
  field: z.string().min(2),
  eligibility: z.string().min(3),
  deadline: z.string().min(4),
  amount: z.string().min(1),
  link: z.string().url(),
  description: z.string().min(8),
  minAPS: z.number().int().min(0).max(50).optional(),
});

export type BursaryIngestRecord = z.infer<typeof BursaryIngestSchema>;

export function validateBursaryIngestRecord(input: unknown): BursaryIngestRecord {
  return BursaryIngestSchema.parse(input);
}

export function tryValidateBursaryIngestRecord(input: unknown): { ok: true; value: BursaryIngestRecord } | { ok: false; issues: string[] } {
  const result = BursaryIngestSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  return {
    ok: false,
    issues: result.error.issues.map((issue) => `${issue.path.join('.') || 'record'}: ${issue.message}`),
  };
}

export function buildCompositeOpportunityKey(record: {
  provider: string;
  name: string;
  deadline: string;
  field?: string;
}): string {
  return [record.provider, record.name, record.deadline, record.field || 'all']
    .map((part) => normalizeToken(part))
    .join('|');
}

export function detectNearDuplicateName(a: string, b: string, maxDistance = 3): boolean {
  const left = normalizeToken(a);
  const right = normalizeToken(b);
  return levenshteinDistance(left, right) <= maxDistance;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));

  for (let i = 0; i <= b.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}
