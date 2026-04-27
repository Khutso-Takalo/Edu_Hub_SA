import { db, type Application } from '../schema';

export const applicationRepository = {
  async getUserApplications(userId: string): Promise<Application[]> {
    return db.applications.where('userId').equals(userId).toArray();
  },

  async add(application: Application): Promise<string> {
    await db.applications.put(application);
    return application.id;
  },

  async updateStatus(id: string, status: Application['status']): Promise<number> {
    return db.applications.update(id, {
      status,
      updatedAt: new Date().toISOString(),
    });
  },

  async update(id: string, changes: Partial<Application>): Promise<number> {
    return db.applications.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id: string): Promise<void> {
    await db.applications.delete(id);
  },
};
