import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '@/infrastructure/database/indexeddb/schema';
import type { Application } from '@/infrastructure/database/indexeddb/schema';
import type { UserProfile } from '@/hooks/useAuth';
import { v4 as uuidv4 } from 'uuid';

interface BadgeProgress {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

interface UseGamificationResult {
  loading: boolean;
  totalPoints: number;
  level: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  checkedInToday: boolean;
  recentEvents: Array<{ id: string; type: string; points: number; createdAt: string; note?: string }>;
  badges: BadgeProgress[];
  checkIn: () => Promise<{ ok: boolean; pointsAwarded: number; streak: number }>;
}

const LEVEL_STEP = 150;

function toDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function computeLevel(totalPoints: number): number {
  return Math.max(1, Math.floor(totalPoints / LEVEL_STEP) + 1);
}

function computeStreak(lastCheckInDate?: string, currentStreak = 0): number {
  if (!lastCheckInDate) return 1;

  const today = toDateKey();
  const yesterday = toDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  if (lastCheckInDate === today) return currentStreak;
  if (lastCheckInDate === yesterday) return currentStreak + 1;
  return 1;
}

function buildBadges(
  totalPoints: number,
  currentStreak: number,
  applications: Application[],
  profile?: UserProfile | null
): BadgeProgress[] {
  const completedProfile = !!profile &&
    !!profile.grade_level &&
    !!profile.province &&
    (profile.subjects?.length || 0) > 0 &&
    (profile.career_interests?.length || 0) > 0;

  const submittedCount = applications.filter((item) =>
    item.status === 'submitted' || item.status === 'under-review' || item.status === 'successful'
  ).length;

  return [
    {
      id: 'badge-first-check-in',
      title: 'First Check-In',
      description: 'Complete your first daily check-in.',
      unlocked: totalPoints >= 25,
    },
    {
      id: 'badge-streak-3',
      title: '3-Day Momentum',
      description: 'Keep a 3-day check-in streak.',
      unlocked: currentStreak >= 3,
    },
    {
      id: 'badge-streak-7',
      title: '7-Day Discipline',
      description: 'Keep a 7-day check-in streak.',
      unlocked: currentStreak >= 7,
    },
    {
      id: 'badge-submissions',
      title: 'Submission Sprint',
      description: 'Reach 3 submitted or in-review applications.',
      unlocked: submittedCount >= 3,
    },
    {
      id: 'badge-profile-pro',
      title: 'Profile Pro',
      description: 'Complete your learner profile.',
      unlocked: completedProfile,
    },
    {
      id: 'badge-500-points',
      title: '500 Club',
      description: 'Earn at least 500 points.',
      unlocked: totalPoints >= 500,
    },
  ];
}

export function useGamification(userId?: string, applications: Application[] = [], profile?: UserProfile | null): UseGamificationResult {
  const [loading, setLoading] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [lastCheckInDate, setLastCheckInDate] = useState<string | undefined>(undefined);
  const [recentEvents, setRecentEvents] = useState<Array<{ id: string; type: string; points: number; createdAt: string; note?: string }>>([]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const existingProfile = await db.table('gamificationProfiles').get(userId);
    const now = new Date().toISOString();

    if (!existingProfile) {
      const starter = {
        userId,
        totalPoints: 0,
        level: 1,
        currentStreak: 0,
        longestStreak: 0,
        updatedAt: now,
      };
      await db.table('gamificationProfiles').put(starter);
      setTotalPoints(0);
      setCurrentStreak(0);
      setLongestStreak(0);
      setLastCheckInDate(undefined);
    } else {
      setTotalPoints(existingProfile.totalPoints || 0);
      setCurrentStreak(existingProfile.currentStreak || 0);
      setLongestStreak(existingProfile.longestStreak || 0);
      setLastCheckInDate(existingProfile.lastCheckInDate);
    }

    const events = await db
      .table('gamificationEvents')
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('createdAt');

    setRecentEvents(
      events.slice(0, 8).map((event) => ({
        id: event.id,
        type: event.type,
        points: event.points,
        createdAt: event.createdAt,
        note: event.note,
      }))
    );

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkedInToday = useMemo(() => lastCheckInDate === toDateKey(), [lastCheckInDate]);

  const level = useMemo(() => computeLevel(totalPoints), [totalPoints]);
  const pointsToNextLevel = useMemo(() => {
    const nextLevelThreshold = level * LEVEL_STEP;
    return Math.max(0, nextLevelThreshold - totalPoints);
  }, [level, totalPoints]);

  const badges = useMemo(
    () => buildBadges(totalPoints, currentStreak, applications, profile),
    [applications, currentStreak, profile, totalPoints]
  );

  const checkIn = useCallback(async () => {
    if (!userId) return { ok: false, pointsAwarded: 0, streak: 0 };

    const profileRow = await db.table('gamificationProfiles').get(userId);
    const now = new Date().toISOString();
    const today = toDateKey();

    if (profileRow?.lastCheckInDate === today) {
      return { ok: false, pointsAwarded: 0, streak: profileRow?.currentStreak || 0 };
    }

    const nextStreak = computeStreak(profileRow?.lastCheckInDate, profileRow?.currentStreak || 0);
    const streakBonus = nextStreak >= 7 ? 20 : nextStreak >= 3 ? 10 : 0;
    const basePoints = 25;
    const pointsAwarded = basePoints + streakBonus;
    const nextTotalPoints = (profileRow?.totalPoints || 0) + pointsAwarded;

    const updatedProfile = {
      userId,
      totalPoints: nextTotalPoints,
      level: computeLevel(nextTotalPoints),
      currentStreak: nextStreak,
      longestStreak: Math.max(profileRow?.longestStreak || 0, nextStreak),
      lastCheckInDate: today,
      updatedAt: now,
    };

    await db.transaction('rw', db.table('gamificationProfiles'), db.table('gamificationEvents'), async () => {
      await db.table('gamificationProfiles').put(updatedProfile);
      await db.table('gamificationEvents').put({
        id: uuidv4(),
        userId,
        type: 'daily-check-in',
        points: pointsAwarded,
        note: streakBonus > 0 ? `Streak bonus +${streakBonus}` : 'Daily consistency reward',
        createdAt: now,
      });
    });

    setTotalPoints(updatedProfile.totalPoints);
    setCurrentStreak(updatedProfile.currentStreak);
    setLongestStreak(updatedProfile.longestStreak);
    setLastCheckInDate(today);

    setRecentEvents((prev) => [
      {
        id: uuidv4(),
        type: 'daily-check-in',
        points: pointsAwarded,
        createdAt: now,
        note: streakBonus > 0 ? `Streak bonus +${streakBonus}` : 'Daily consistency reward',
      },
      ...prev,
    ].slice(0, 8));

    return { ok: true, pointsAwarded, streak: nextStreak };
  }, [userId]);

  return {
    loading,
    totalPoints,
    level,
    pointsToNextLevel,
    currentStreak,
    longestStreak,
    checkedInToday,
    recentEvents,
    badges,
    checkIn,
  };
}
