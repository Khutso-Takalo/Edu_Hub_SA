import db from '../schema.js';

export const applicationRepository = {
  async getUserApplications(userId) {
    return await db.applications.where('userId').equals(userId).toArray();
  },
  async add(application) {
    return await db.applications.add(application);
  },
  async updateStatus(id, status) {
    return await db.applications.update(id, { status });
  },
  async delete(id) {
    return await db.applications.delete(id);
  }
};