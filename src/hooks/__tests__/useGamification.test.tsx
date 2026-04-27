import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGamification } from '@/hooks/useGamification';
import { db } from '@/infrastructure/database/indexeddb/schema';
import type { Application } from '@/infrastructure/database/indexeddb/schema';
import type { UserProfile } from '@/hooks/useAuth';

const sampleProfile: UserProfile = {
  id: 'game-user-1',
  email: 'learner@example.com',
  full_name: 'Test Learner',
  grade_level: 'Grade 12',
  subjects: [
    { name: 'Mathematics', mark: 75 },
    { name: 'Physical Sciences', mark: 72 },
  ],
  aps_score: 34,
  career_interests: ['Engineering'],
  province: 'Gauteng',
  saved_bursaries: [],
  saved_institutions: [],
  saved_careers: [],
  profile_completed: true,
};

const sampleApplications: Application[] = [
  {
    id: 'app-1',
    userId: 'game-user-1',
    bursaryId: 'b1',
    status: 'submitted',
    deadlineDate: '2026-06-30',
    checklist: { idCopy: true, transcript: true, motivationLetter: false, references: false },
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
];

describe('useGamification', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  test('awards points and updates streak on check-in', async () => {
    const { result } = renderHook(() => useGamification(sampleProfile.id, sampleApplications, sampleProfile));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalPoints).toBe(0);
    expect(result.current.checkedInToday).toBe(false);

    const checkInResult = await result.current.checkIn();
    expect(checkInResult.ok).toBe(true);
    expect(checkInResult.pointsAwarded).toBeGreaterThanOrEqual(25);

    await waitFor(() => expect(result.current.totalPoints).toBeGreaterThanOrEqual(25));
    expect(result.current.checkedInToday).toBe(true);
    expect(result.current.currentStreak).toBeGreaterThanOrEqual(1);
    expect(result.current.recentEvents.length).toBeGreaterThan(0);
  });

  test('prevents double check-in on same day', async () => {
    const { result } = renderHook(() => useGamification('game-user-2', [], sampleProfile));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const first = await result.current.checkIn();
    const second = await result.current.checkIn();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(second.pointsAwarded).toBe(0);
  });
});
