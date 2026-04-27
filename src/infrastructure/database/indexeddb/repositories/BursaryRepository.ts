import { db } from '../schema';
import type { Bursary } from '@/data/staticData';

export const bursaryRepository = {
  async getAll(): Promise<Bursary[]> {
    return db.bursaries.toArray();
  },

  async getById(id: string): Promise<Bursary | undefined> {
    return db.bursaries.get(id);
  },

  async add(bursary: Bursary): Promise<string> {
    await db.bursaries.put(bursary);
    return bursary.id;
  },

  async bulkAdd(bursaries: Bursary[]): Promise<number> {
    await db.bursaries.bulkPut(bursaries);
    return bursaries.length;
  },

  async update(id: string, changes: Partial<Bursary>): Promise<number> {
    return db.bursaries.update(id, changes);
  },

  async delete(id: string): Promise<void> {
    await db.bursaries.delete(id);
  },

  async getUpcomingDeadlines(days = 30): Promise<Bursary[]> {
    const now = Date.now();
    const future = now + days * 24 * 60 * 60 * 1000;

    return db.bursaries
      .filter((bursary) => {
        const deadline = new Date(bursary.deadline).getTime();
        return deadline >= now && deadline <= future;
      })
      .toArray();
  },

  async search(query: string): Promise<Bursary[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return db.bursaries.toArray();
    }

    return db.bursaries
      .filter((bursary) => {
        return (
          bursary.name.toLowerCase().includes(normalized) ||
          bursary.provider.toLowerCase().includes(normalized) ||
          bursary.field.toLowerCase().includes(normalized) ||
          (bursary.description || '').toLowerCase().includes(normalized)
        );
      })
      .toArray();
  },
};
