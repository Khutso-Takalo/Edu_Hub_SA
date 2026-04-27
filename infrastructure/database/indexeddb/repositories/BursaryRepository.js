import db from '../schema.js';

export const bursaryRepository = {
  async getAll() {
    return await db.bursaries.toArray();
  },
  async getById(id) {
    return await db.bursaries.get(id);
  },
  async add(bursary) {
    return await db.bursaries.add(bursary);
  },
  async bulkAdd(bursaries) {
    return await db.bursaries.bulkAdd(bursaries);
  },
  async update(id, changes) {
    return await db.bursaries.update(id, changes);
  },
  async getUpcomingDeadlines(days = 30) {
    const today = new Date().toISOString();
    const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    return await db.bursaries.where('deadline').between(today, future).toArray();
  },
  async search(query) {
    const lowerQuery = query.toLowerCase();
    return await db.bursaries
      .filter(b => b.name.toLowerCase().includes(lowerQuery))
      .toArray();
  }
};