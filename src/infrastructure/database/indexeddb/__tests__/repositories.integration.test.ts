import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db, type Application } from '@/infrastructure/database/indexeddb/schema';
import { bursaryRepository } from '@/infrastructure/database/indexeddb/repositories/BursaryRepository';
import { applicationRepository } from '@/infrastructure/database/indexeddb/repositories/ApplicationRepository';
import seedBursaries from '@/data/seed/bursaries.json';

describe('indexeddb repositories integration', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.bursaries.bulkPut(seedBursaries);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('searches bursaries by provider or name', async () => {
    const results = await bursaryRepository.search('nsfas');
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.some(
        (item) =>
          item.name.toLowerCase().includes('nsfas') ||
          item.provider.toLowerCase().includes('nsfas')
      )
    ).toBe(true);
  });

  it('creates, updates and deletes application records', async () => {
    const application: Application = {
      id: 'app-1',
      userId: 'user-1',
      bursaryId: seedBursaries[0].id,
      status: 'draft',
      deadlineDate: seedBursaries[0].deadline,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const insertedId = await applicationRepository.add(application);
    expect(insertedId).toBe('app-1');

    const userApplications = await applicationRepository.getUserApplications('user-1');
    expect(userApplications).toHaveLength(1);
    expect(userApplications[0].status).toBe('draft');

    await applicationRepository.updateStatus('app-1', 'submitted');
    const updated = await applicationRepository.getUserApplications('user-1');
    expect(updated[0].status).toBe('submitted');

    await applicationRepository.delete('app-1');
    const afterDelete = await applicationRepository.getUserApplications('user-1');
    expect(afterDelete).toHaveLength(0);
  });
});
