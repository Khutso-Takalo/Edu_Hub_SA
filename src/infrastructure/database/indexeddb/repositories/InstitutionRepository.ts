import { db } from '../schema';
import type { Institution } from '@/data/staticData';

export const institutionRepository = {
  async getAll(): Promise<Institution[]> {
    return db.institutions.toArray();
  },

  async getById(id: string): Promise<Institution | undefined> {
    return db.institutions.get(id);
  },

  async bulkAdd(institutions: Institution[]): Promise<number> {
    await db.institutions.bulkPut(institutions);
    return institutions.length;
  },

  async search(query: string): Promise<Institution[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return db.institutions.toArray();
    }

    return db.institutions
      .filter((institution) => {
        return (
          institution.name.toLowerCase().includes(normalized) ||
          institution.location.toLowerCase().includes(normalized) ||
          institution.province.toLowerCase().includes(normalized) ||
          institution.courses.some((course) => course.toLowerCase().includes(normalized))
        );
      })
      .toArray();
  },
};
