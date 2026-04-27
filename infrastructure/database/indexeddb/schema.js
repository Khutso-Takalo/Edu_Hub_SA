import Dexie from 'dexie';

export const db = new Dexie('BursaryDatabase');

db.version(1).stores({
  bursaries: '++id, name, deadline, verificationSource, provinceEligibility',
  applications: '++id, userId, bursaryId, status, deadlineDate',
  users: '++id, email, phone, province',
  notifications: '++id, userId, message, channel, createdAt',
  verifiedLinks: '++id, entityType, entityId, url, status, lastVerified'
});

// Phase C: CV Builder & ATS Tools
db.version(2).stores({
  bursaries: '++id, name, deadline, verificationSource, provinceEligibility',
  applications: '++id, userId, bursaryId, status, deadlineDate',
  users: '++id, email, phone, province',
  notifications: '++id, userId, message, channel, createdAt',
  verifiedLinks: '++id, entityType, entityId, url, status, lastVerified',
  cvProfiles: '++id, userId, selectedTemplate, createdAt, updatedAt',
  cvExperiences: '++id, cvProfileId, startDate, endDate',
  cvEducation: '++id, cvProfileId, graduationYear',
  cvSkills: '++id, cvProfileId, skill',
  cvAchievements: '++id, cvProfileId, achievementType',
  cvCertifications: '++id, cvProfileId, certificationDate',
  atsAnalyses: '++id, cvProfileId, analysisDate, overallScore'
});

export default db;