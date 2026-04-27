import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import seedBursaries from '@/data/seed/bursaries.json';
import seedInstitutions from '@/data/seed/institutions.json';
import { db } from '@/infrastructure/database/indexeddb/schema';
import { seedDatabase, getSeedAudit } from '@/infrastructure/database/indexeddb/seed';

describe('seedDatabase integration', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('seeds bursaries and institutions when empty', async () => {
    const audit = await seedDatabase();

    const bursaryRows = await db.bursaries.toArray();
    const institutionRows = await db.institutions.toArray();
    expect(bursaryRows.length).toBe(seedBursaries.length);
    expect(institutionRows.length).toBe(seedInstitutions.length);
    expect(bursaryRows[0]?.id).toBe(seedBursaries[0]?.id);
    expect(audit.seedVersion).not.toBe('unknown');
    expect(audit.lastSeededAt).not.toBeNull();
  });

  it('does not duplicate records when called again', async () => {
    await seedDatabase();
    await seedDatabase();

    const bursaryCount = await db.bursaries.count();
    const institutionCount = await db.institutions.count();
    expect(bursaryCount).toBe(seedBursaries.length);
    expect(institutionCount).toBe(seedInstitutions.length);
  });

  it('writes auditable seed metadata', async () => {
    await seedDatabase();

    const [seedVersion, lastSeededAt, seedSummary] = await Promise.all([
      db.meta.get('seedVersion'),
      db.meta.get('lastSeededAt'),
      db.meta.get('seedSummary'),
    ]);

    expect(seedVersion?.value).toBeTruthy();
    expect(lastSeededAt?.value).toBeTruthy();
    expect(seedSummary?.value).toContain('bursaries');

    const audit = await getSeedAudit();
    expect(audit.bursaryCount).toBe(seedBursaries.length);
    expect(audit.institutionCount).toBe(seedInstitutions.length);
  });
});
