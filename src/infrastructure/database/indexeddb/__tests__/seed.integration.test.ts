import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import seedBursaries from '@/data/seed/bursaries.json';
import seedInstitutions from '@/data/seed/institutions.json';
import { computeLifecycle } from '@/lib/lifecycleManager';
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
    const eligibleBursaries = seedBursaries.filter(record => {
      const lifecycle = computeLifecycle({
        lastVerified: record.lastVerified,
        verificationSource: record.verificationSource || 'unverified',
        deadline: record.deadline,
        brokenLink: record.brokenLink ?? false,
        manualQuarantine: record.quarantine ?? false,
      });
      return !lifecycle.quarantine && !lifecycle.isExpired;
    });
    expect(bursaryRows.length).toBe(eligibleBursaries.length);
    expect(institutionRows.length).toBe(seedInstitutions.length);
    // names/ids may be normalized during seeding; counts validated above
    expect(audit.seedVersion).not.toBe('unknown');
    expect(audit.lastSeededAt).not.toBeNull();
  });

  it('does not duplicate records when called again', async () => {
    await seedDatabase();
    await seedDatabase();

    const bursaryCount = await db.bursaries.count();
    const institutionCount = await db.institutions.count();
    const eligibleCount = seedBursaries.filter(record => {
      const lifecycle = computeLifecycle({
        lastVerified: record.lastVerified,
        verificationSource: record.verificationSource || 'unverified',
        deadline: record.deadline,
        brokenLink: record.brokenLink ?? false,
        manualQuarantine: record.quarantine ?? false,
      });
      return !lifecycle.quarantine && !lifecycle.isExpired;
    }).length;
    expect(bursaryCount).toBe(eligibleCount);
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
    const eligibleAuditCount = seedBursaries.filter(record => {
      const lifecycle = computeLifecycle({
        lastVerified: record.lastVerified,
        verificationSource: record.verificationSource || 'unverified',
        deadline: record.deadline,
        brokenLink: record.brokenLink ?? false,
        manualQuarantine: record.quarantine ?? false,
      });
      return !lifecycle.quarantine && !lifecycle.isExpired;
    }).length;
    expect(audit.bursaryCount).toBe(eligibleAuditCount);
    expect(audit.institutionCount).toBe(seedInstitutions.length);
  });
});
