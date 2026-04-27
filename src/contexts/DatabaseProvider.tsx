/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { db } from '@/infrastructure/database/indexeddb/schema';
import { seedDatabase } from '@/infrastructure/database/indexeddb/seed';
import { bursaryRepository } from '@/infrastructure/database/indexeddb/repositories/BursaryRepository';
import { applicationRepository } from '@/infrastructure/database/indexeddb/repositories/ApplicationRepository';
import { institutionRepository } from '@/infrastructure/database/indexeddb/repositories/InstitutionRepository';
import { notificationRepository } from '@/infrastructure/database/indexeddb/repositories/NotificationRepository';
import { VerificationScheduler } from '@/services/VerificationScheduler';
import { runtimeEnv } from '@/lib/runtimeEnv';
import type { Bursary, Institution } from '@/data/staticData';
import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';

// Define repository types
export interface BursaryRepository {
  getAll: () => Promise<Bursary[]>;
  getById: (id: string) => Promise<Bursary | undefined>;
  add: (bursary: Bursary) => Promise<string>;
  bulkAdd: (bursaries: Bursary[]) => Promise<number>;
  update: (id: string, changes: Partial<Bursary>) => Promise<number>;
  delete: (id: string) => Promise<void>;
  getUpcomingDeadlines: (days?: number) => Promise<Bursary[]>;
  search: (query: string) => Promise<Bursary[]>;
}

export interface ApplicationRepository {
  getUserApplications: (userId: string) => Promise<Application[]>;
  add: (application: Application) => Promise<string>;
  updateStatus: (id: string, status: Application['status']) => Promise<number>;
  update: (id: string, changes: Partial<Application>) => Promise<number>;
  delete: (id: string) => Promise<void>;
}

export interface InstitutionRepository {
  getAll: () => Promise<Institution[]>;
  getById: (id: string) => Promise<Institution | undefined>;
  bulkAdd: (institutions: Institution[]) => Promise<number>;
  search: (query: string) => Promise<Institution[]>;
}

export interface NotificationRepository {
  getUserNotifications: (userId: string) => Promise<NotificationRecord[]>;
  add: (notification: Omit<NotificationRecord, 'id' | 'createdAt'>) => Promise<string>;
  markRead: (id: string) => Promise<number>;
  markAllRead: (userId: string) => Promise<number>;
  update: (id: string, changes: Partial<NotificationRecord>) => Promise<number>;
  delete: (id: string) => Promise<void>;
}

interface DatabaseContextValue {
  bursaryRepo: BursaryRepository;
  applicationRepo: ApplicationRepository;
  institutionRepo: InstitutionRepository;
  notificationRepo: NotificationRepository;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const verificationSchedulerRef = useRef<VerificationScheduler | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await db.open();
        await seedDatabase();
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize local database:', error);
        setInitError('Could not initialize the local database. Please refresh and try again.');
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!runtimeEnv.enableBackgroundVerification) {
      return;
    }

    const scheduler = new VerificationScheduler(
      bursaryRepository as BursaryRepository,
      {
        intervalMinutes: runtimeEnv.verificationIntervalMinutes,
        batchSize: runtimeEnv.verificationBatchSize,
        onlyWhenOnline: true,
        pauseWhenHidden: true,
      },
      console
    );

    verificationSchedulerRef.current = scheduler;
    scheduler.start(true);

    (window as Window & { __EDUHUB_VERIFICATION_SCHEDULER__?: VerificationScheduler }).__EDUHUB_VERIFICATION_SCHEDULER__ =
      scheduler;

    return () => {
      scheduler.stop();
      if ((window as Window & { __EDUHUB_VERIFICATION_SCHEDULER__?: VerificationScheduler }).__EDUHUB_VERIFICATION_SCHEDULER__ === scheduler) {
        delete (window as Window & { __EDUHUB_VERIFICATION_SCHEDULER__?: VerificationScheduler }).__EDUHUB_VERIFICATION_SCHEDULER__;
      }
      verificationSchedulerRef.current = null;
    };
  }, [isReady]);

  const value: DatabaseContextValue = {
    bursaryRepo: bursaryRepository as BursaryRepository,
    applicationRepo: applicationRepository as ApplicationRepository,
    institutionRepo: institutionRepository as InstitutionRepository,
    notificationRepo: notificationRepository as NotificationRepository,
  };

  if (!isReady) {
    if (initError) {
      return <div className="p-4 text-red-600">{initError}</div>;
    }
    return <div className="p-4">Loading local database...</div>;
  }

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
}