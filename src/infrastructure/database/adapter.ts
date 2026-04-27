import type { Bursary, Institution } from '@/data/staticData';
import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';

export interface DataAdapter {
  listBursaries(): Promise<Bursary[]>;
  listInstitutions(): Promise<Institution[]>;
  listApplications(userId: string): Promise<Application[]>;
  createApplication(application: Application): Promise<string>;
  listNotifications(userId: string): Promise<NotificationRecord[]>;
}
