import seedBursaries from '@/data/seed/bursaries.json';
import seedInstitutions from '@/data/seed/institutions.json';
import { db } from './schema';

const SEED_VERSION = '2026-04-16.1';

export interface SeedAudit {
  seedVersion: string;
  lastSeededAt: string | null;
  bursaryCount: number;
  institutionCount: number;
}

export async function getSeedAudit(): Promise<SeedAudit> {
  const [bursaryCount, institutionCount, versionRecord, lastSeededAtRecord] = await Promise.all([
    db.bursaries.count(),
    db.institutions.count(),
    db.meta.get('seedVersion'),
    db.meta.get('lastSeededAt'),
  ]);

  return {
    seedVersion: versionRecord?.value || 'unknown',
    lastSeededAt: lastSeededAtRecord?.value || null,
    bursaryCount,
    institutionCount,
  };
}

export async function seedDatabase(): Promise<SeedAudit> {
  const bursaryCount = await db.bursaries.count();
  const institutionCount = await db.institutions.count();
  const seedVersionRecord = await db.meta.get('seedVersion');

  const shouldSeed =
    bursaryCount === 0 ||
    institutionCount === 0 ||
    seedVersionRecord?.value !== SEED_VERSION;

  if (!shouldSeed) {
    return getSeedAudit();
  }

  const now = new Date().toISOString();
  const normalizedBursaries = seedBursaries.map((item) => ({
    ...item,
    verificationSource: item.verificationSource || 'official',
    lastVerified: item.lastVerified || now,
    freshnessScore: item.freshnessScore ?? 100,
  }));

  await db.transaction('rw', db.bursaries, db.institutions, db.meta, async () => {
    await db.bursaries.bulkPut(normalizedBursaries);
    await db.institutions.bulkPut(seedInstitutions);

    await db.meta.put({
      key: 'lastSeededAt',
      value: now,
      updatedAt: now,
    });

    await db.meta.put({
      key: 'seedVersion',
      value: SEED_VERSION,
      updatedAt: now,
    });

    await db.meta.put({
      key: 'seedSummary',
      value: JSON.stringify({
        bursaries: normalizedBursaries.length,
        institutions: seedInstitutions.length,
      }),
      updatedAt: now,
    });
  });

  return getSeedAudit();
}
