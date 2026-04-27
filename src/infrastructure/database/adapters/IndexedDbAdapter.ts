import { bursaryRepository } from '@/infrastructure/database/indexeddb/repositories/BursaryRepository';
import { institutionRepository } from '@/infrastructure/database/indexeddb/repositories/InstitutionRepository';
import { applicationRepository } from '@/infrastructure/database/indexeddb/repositories/ApplicationRepository';
import { notificationRepository } from '@/infrastructure/database/indexeddb/repositories/NotificationRepository';
import type { DataAdapter } from '@/infrastructure/database/adapter';

export const indexedDbAdapter: DataAdapter = {
  listBursaries: () => bursaryRepository.getAll(),
  listInstitutions: () => institutionRepository.getAll(),
  listApplications: (userId) => applicationRepository.getUserApplications(userId),
  createApplication: (application) => applicationRepository.add(application),
  listNotifications: (userId) => notificationRepository.getUserNotifications(userId),
};
