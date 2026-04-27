import Dexie, { type Table } from 'dexie';
import type { Bursary } from '@/data/staticData';
import type { Institution } from '@/data/staticData';

export interface Application {
  id: string;
  userId: string;
  bursaryId: string;
  status: 'draft' | 'submitted' | 'under-review' | 'successful' | 'unsuccessful';
  deadlineDate?: string;
  notes?: string;
  documentsSubmitted?: string[];
  checklist?: {
    idCopy: boolean;
    transcript: boolean;
    motivationLetter: boolean;
    references: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserRecord {
  id: string;
  email: string;
  phone?: string;
  province?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  channel: 'in-app' | 'email' | 'sms';
  type: 'deadline-reminder' | 'system' | 'sync';
  entityId?: string;
  dueDate?: string;
  createdAt: string;
  read?: boolean;
}

export interface MetaRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export interface EssayDraft {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  content: string;
  wordCount: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BursaryFlagRecord {
  id: string;
  bursaryId: string;
  bursaryName: string;
  reason: string;
  details?: string;
  status: 'open' | 'resolved';
  reporterUserId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface GamificationProfileRecord {
  userId: string;
  totalPoints: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastCheckInDate?: string;
  updatedAt: string;
}

export interface GamificationEventRecord {
  id: string;
  userId: string;
  type: 'daily-check-in' | 'profile-complete' | 'application-progress' | 'milestone';
  points: number;
  note?: string;
  createdAt: string;
}

export interface FeedbackEntryRecord {
  id: string;
  userId?: string;
  message: string;
  context?: string;
  createdAt: string;
}

export interface ClassroomRecord {
  id: string;
  code: string;
  teacherName: string;
  createdAt: string;
}

export interface ClassroomMemberRecord {
  id: string;
  classroomId: string;
  userId: string;
  joinedAt: string;
}

export interface ScraperHeartbeatRecord {
  id: string;
  sourceId: string;
  runAt: string;
  success: boolean;
  rowsScraped: number;
  errorMessage?: string;
}

export interface ReconciliationFlagRecord {
  id: string;
  entityType: 'bursary';
  entityId: string;
  sourceIds: string[];
  conflictFields: string[];
  status: 'open' | 'resolved';
  createdAt: string;
}

export class EduHubDatabase extends Dexie {
  bursaries!: Table<Bursary, string>;
  institutions!: Table<Institution, string>;
  applications!: Table<Application, string>;
  users!: Table<UserRecord, string>;
  notifications!: Table<NotificationRecord, string>;
  meta!: Table<MetaRecord, string>;
  essayDrafts!: Table<EssayDraft, string>;
  bursaryFlags!: Table<BursaryFlagRecord, string>;
  gamificationProfiles!: Table<GamificationProfileRecord, string>;
  gamificationEvents!: Table<GamificationEventRecord, string>;
  feedbackEntries!: Table<FeedbackEntryRecord, string>;
  classrooms!: Table<ClassroomRecord, string>;
  classroomMembers!: Table<ClassroomMemberRecord, string>;
  scraperHeartbeats!: Table<ScraperHeartbeatRecord, string>;
  reconciliationFlags!: Table<ReconciliationFlagRecord, string>;

  constructor() {
    super('EduHubDatabase');
    this.version(1).stores({
      bursaries: 'id, name, provider, field, deadline',
      applications: 'id, userId, bursaryId, status, deadlineDate',
      users: 'id, email, province',
      notifications: 'id, userId, createdAt, read',
    });

    this.version(2).stores({
      bursaries: 'id, name, provider, field, deadline',
      institutions: 'id, name, type, province, location',
      applications: 'id, userId, bursaryId, status, deadlineDate, updatedAt',
      users: 'id, email, province',
      notifications: 'id, userId, type, createdAt, read, dueDate',
      meta: 'key, updatedAt',
    });

    this.version(3).stores({
      bursaries: 'id, name, provider, field, deadline',
      institutions: 'id, name, type, province, location',
      applications: 'id, userId, bursaryId, status, deadlineDate, updatedAt',
      users: 'id, email, province',
      notifications: 'id, userId, type, createdAt, read, dueDate',
      meta: 'key, updatedAt',
      essayDrafts: 'id, userId, updatedAt, createdAt',
    });

    this.version(4).stores({
      bursaries: 'id, name, provider, field, deadline',
      institutions: 'id, name, type, province, location',
      applications: 'id, userId, bursaryId, status, deadlineDate, updatedAt',
      users: 'id, email, province',
      notifications: 'id, userId, type, createdAt, read, dueDate',
      meta: 'key, updatedAt',
      essayDrafts: 'id, userId, updatedAt, createdAt',
      bursaryFlags: 'id, bursaryId, status, createdAt, reporterUserId',
    });

    this.version(5).stores({
      bursaries: 'id, name, provider, field, deadline',
      institutions: 'id, name, type, province, location',
      applications: 'id, userId, bursaryId, status, deadlineDate, updatedAt',
      users: 'id, email, province',
      notifications: 'id, userId, type, createdAt, read, dueDate',
      meta: 'key, updatedAt',
      essayDrafts: 'id, userId, updatedAt, createdAt',
      bursaryFlags: 'id, bursaryId, status, createdAt, reporterUserId',
      gamificationProfiles: 'userId, updatedAt, level, totalPoints, currentStreak',
      gamificationEvents: 'id, userId, type, createdAt',
    });

    this.version(6).stores({
      bursaries: 'id, name, provider, field, deadline, isGolden, isSponsored, freshnessScore',
      institutions: 'id, name, type, province, location',
      applications: 'id, userId, bursaryId, status, deadlineDate, updatedAt',
      users: 'id, email, province',
      notifications: 'id, userId, type, createdAt, read, dueDate',
      meta: 'key, updatedAt',
      essayDrafts: 'id, userId, updatedAt, createdAt',
      bursaryFlags: 'id, bursaryId, status, createdAt, reporterUserId',
      gamificationProfiles: 'userId, updatedAt, level, totalPoints, currentStreak',
      gamificationEvents: 'id, userId, type, createdAt',
      feedbackEntries: 'id, userId, createdAt',
      classrooms: 'id, code, createdAt',
      classroomMembers: 'id, classroomId, userId, joinedAt',
    });

    this.version(7).stores({
      bursaries: 'id, name, provider, field, deadline, isGolden, isSponsored, freshnessScore, needsReview',
      institutions: 'id, name, type, province, location',
      applications: 'id, userId, bursaryId, status, deadlineDate, updatedAt',
      users: 'id, email, province',
      notifications: 'id, userId, type, createdAt, read, dueDate',
      meta: 'key, updatedAt',
      essayDrafts: 'id, userId, updatedAt, createdAt',
      bursaryFlags: 'id, bursaryId, status, createdAt, reporterUserId',
      gamificationProfiles: 'userId, updatedAt, level, totalPoints, currentStreak',
      gamificationEvents: 'id, userId, type, createdAt',
      feedbackEntries: 'id, userId, createdAt',
      classrooms: 'id, code, createdAt',
      classroomMembers: 'id, classroomId, userId, joinedAt',
      scraperHeartbeats: 'id, sourceId, runAt, success',
      reconciliationFlags: 'id, entityType, entityId, status, createdAt',
    });
  }
}

export const db = new EduHubDatabase();
