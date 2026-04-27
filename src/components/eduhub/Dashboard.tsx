import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Award, Building2, FileText, BookOpen, TrendingUp, ArrowRight, Heart, Clock, ChevronRight, Zap, Target, AlertTriangle, CheckCircle2, ClipboardList, Sparkles, FileUser, PenLine, Trophy, Flame, CalendarCheck, SlidersHorizontal, WifiOff, Gauge } from 'lucide-react';
import type { UserProfile } from '@/hooks/useAuth';
import { careers, getCareerRecommendations } from '@/data/staticData';
import { getLMISignal } from '@/data/lmi';
import { useBursaries } from '@/hooks/useBursaries';
import { useDataFreshness } from '@/hooks/useDataFreshness';
import { useGamification } from '@/hooks/useGamification';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { toast } from '@/components/ui/use-toast';
import type { Application } from '@/infrastructure/database/indexeddb/schema';
import KnowledgeCards from '@/components/eduhub/KnowledgeCards';

interface DashboardProps {
  profile: UserProfile;
  onNavigate: (view: string) => void;
  applications: Application[];
  upcomingDeadlines: Application[];
  onUpdateApplicationStatus: (id: string, status: Application['status']) => Promise<void>;
  onToggleChecklistItem: (id: string, key: 'idCopy' | 'transcript' | 'motivationLetter' | 'references') => Promise<void>;
  onRemoveApplication: (id: string) => Promise<void>;
}

type DashboardMode = 'launch' | 'momentum' | 'sprint';
type DashboardDensity = 'cozy' | 'compact';

const DASHBOARD_DENSITY_KEY = 'eduhub:dashboard-density:v1';

const readDensityPreference = (): DashboardDensity => {
  if (typeof window === 'undefined') return 'cozy';
  const stored = window.localStorage.getItem(DASHBOARD_DENSITY_KEY);
  return stored === 'compact' ? 'compact' : 'cozy';
};

const getExperimentVariant = (userId: string): 'A' | 'B' => {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
};

const Dashboard: React.FC<DashboardProps> = ({
  profile,
  onNavigate,
  applications,
  upcomingDeadlines,
  onUpdateApplicationStatus,
  onToggleChecklistItem,
  onRemoveApplication,
}) => {
  const { bursaries } = useBursaries();
  const { lastUpdated } = useDataFreshness();
  const { isOnline, updateReady, canInstall } = usePwaStatus();
  const {
    totalPoints,
    level,
    pointsToNextLevel,
    currentStreak,
    longestStreak,
    checkedInToday,
    badges,
    recentEvents,
    checkIn,
  } = useGamification(profile.id, applications, profile);
  const [density, setDensity] = useState<DashboardDensity>(readDensityPreference);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DASHBOARD_DENSITY_KEY, density);
  }, [density]);

  const recommendations = profile.subjects?.length && profile.career_interests?.length
    ? getCareerRecommendations(profile.subjects, profile.career_interests, profile.aps_score)
    : careers.slice(0, 5);

  const closingBursaries = bursaries
    .filter(b => new Date(b.deadline) > new Date())
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const personalizedBursaries = useMemo(() => {
    const now = Date.now();
    const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
    const interestSet = new Set((profile.career_interests || []).map((item) => item.toLowerCase()));

    const strictMatches = bursaries.filter((bursary) => {
      const deadline = new Date(bursary.deadline).getTime();
      if (!Number.isFinite(deadline) || deadline < now || deadline > inThirtyDays) return false;

      if (profile.aps_score && bursary.minAPS && profile.aps_score < bursary.minAPS) return false;
      if (profile.province && bursary.provinceEligibility?.length && !bursary.provinceEligibility.includes(profile.province)) return false;

      if (interestSet.size > 0) {
        const fieldMatches = interestSet.has((bursary.field || '').toLowerCase());
        const eligibilityMatches = (bursary.eligibility || '').toLowerCase().includes([...interestSet][0] || '');
        if (!fieldMatches && !eligibilityMatches) return false;
      }

      return true;
    });

    if (strictMatches.length >= 3) {
      return strictMatches.slice(0, 5);
    }

    const fallback = bursaries
      .filter((bursary) => {
        const deadline = new Date(bursary.deadline).getTime();
        return Number.isFinite(deadline) && deadline > now && deadline <= inThirtyDays;
      })
      .slice(0, 5);

    const merged = [...strictMatches, ...fallback].filter(
      (item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index
    );

    return merged.slice(0, 5);
  }, [bursaries, profile.aps_score, profile.career_interests, profile.province]);

  const goldenBursaries = useMemo(
    () => bursaries.filter((item) => item.isGolden).slice(0, 5),
    [bursaries]
  );

  const getSourceLabel = (verificationSource?: string) => {
    if (verificationSource === 'official') return 'Official';
    if (verificationSource === 'scraped') return 'Scraped';
    if (verificationSource === 'community') return 'Community';
    return 'Seed';
  };

  const getFreshnessLabel = (lastVerified?: string) => {
    if (!lastVerified) return 'Verification pending';
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(lastVerified).getTime()) / (24 * 60 * 60 * 1000))
    );
    return days === 0 ? 'Verified today' : `Verified ${days}d ago`;
  };

  const bursaryNameById = new Map(bursaries.map((item) => [item.id, item.name]));

  const getChecklistProgress = (application: Application) => {
    const checklist = application.checklist;
    const items = [
      !!checklist?.idCopy,
      !!checklist?.transcript,
      !!checklist?.motivationLetter,
      !!checklist?.references,
    ];
    const completed = items.filter(Boolean).length;
    return { completed, total: items.length, pct: Math.round((completed / items.length) * 100) };
  };

  const getDeadlineMeta = (deadlineDate?: string) => {
    if (!deadlineDate) {
      return { label: 'No deadline set', className: 'bg-gray-50 text-gray-600 border-gray-200', overdue: false };
    }

    const now = new Date();
    const deadline = new Date(deadlineDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / msPerDay);

    if (daysLeft < 0) {
      return { label: `${Math.abs(daysLeft)}d overdue`, className: 'bg-red-50 text-red-700 border-red-200', overdue: true };
    }
    if (daysLeft === 0) {
      return { label: 'Due today', className: 'bg-amber-50 text-amber-700 border-amber-200', overdue: false };
    }
    if (daysLeft <= 7) {
      return { label: `${daysLeft}d left`, className: 'bg-orange-50 text-orange-700 border-orange-200', overdue: false };
    }
    return { label: `${daysLeft}d left`, className: 'bg-green-50 text-green-700 border-green-200', overdue: false };
  };

  const overdueApplications = applications.filter((item) => {
    if (!item.deadlineDate) return false;
    if (item.status === 'successful' || item.status === 'unsuccessful') return false;
    return new Date(item.deadlineDate).getTime() < Date.now();
  });

  const profileCompletion = [
    profile.grade_level ? 1 : 0,
    profile.subjects?.length ? 1 : 0,
    profile.career_interests?.length ? 1 : 0,
    profile.province ? 1 : 0,
  ].reduce((a, b) => a + b, 0);
  const completionPct = Math.round((profileCompletion / 4) * 100);

  const unlockedBadges = badges.filter((badge) => badge.unlocked);
  const dueSoonApplications = applications.filter((item) => {
    if (!item.deadlineDate) return false;
    if (item.status === 'successful' || item.status === 'unsuccessful') return false;
    const daysLeft = Math.ceil((new Date(item.deadlineDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return daysLeft >= 0 && daysLeft <= 7;
  });

  const dashboardMode: DashboardMode = (() => {
    if (applications.length === 0 || completionPct < 60) return 'launch';
    if (overdueApplications.length > 0 || dueSoonApplications.length >= 2) return 'sprint';
    return 'momentum';
  })();

  const modeCopy: Record<DashboardMode, { title: string; subtitle: string; tone: string }> = {
    launch: {
      title: 'Launch Mode',
      subtitle: 'Set up your profile and track your first opportunity to unlock stronger recommendations.',
      tone: 'bg-sky-50 border-sky-200 text-sky-900',
    },
    momentum: {
      title: 'Momentum Mode',
      subtitle: 'You are on rhythm. Keep streaks active and build toward your next level.',
      tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    },
    sprint: {
      title: 'Sprint Mode',
      subtitle: 'Deadlines are approaching. Prioritize tracker tasks and submit key applications now.',
      tone: 'bg-amber-50 border-amber-200 text-amber-900',
    },
  };

  const experimentVariant = useMemo(() => getExperimentVariant(profile.id), [profile.id]);

  const prioritizedActions = useMemo(() => {
    const actions = [
      { id: 'careers', label: 'Career Explorer', icon: Compass, color: 'bg-blue-600', score: 6, note: 'Match careers to your profile' },
      { id: 'bursaries', label: 'Find Bursaries', icon: Award, color: 'bg-green-600', score: 8, note: 'Find current funding windows' },
      { id: 'institutions', label: 'Institutions', icon: Building2, color: 'bg-purple-600', score: 5, note: 'Compare campuses and options' },
      { id: 'papers', label: 'Past Papers', icon: FileText, color: 'bg-orange-500', score: 4, note: 'Practice for upcoming assessments' },
      { id: 'resources', label: 'Study Guides', icon: BookOpen, color: 'bg-teal-600', score: 5, note: 'Strengthen key subjects' },
      { id: 'knowledge', label: 'Knowledge Hub', icon: Sparkles, color: 'bg-slate-900', score: 3, note: 'Learn practical application tips' },
      { id: 'cv-builder', label: 'CV Builder', icon: FileUser, color: 'bg-red-600', score: 4, note: 'Prepare supporting documents' },
      { id: 'essay-studio', label: 'Essay Studio', icon: PenLine, color: 'bg-cyan-700', score: 5, note: 'Draft motivation letters faster' },
      { id: 'tracker', label: 'Application Tracker', icon: ClipboardList, color: 'bg-indigo-600', score: 7, note: 'Track statuses and checklists' },
    ];

    return actions
      .map((action) => {
        let score = action.score;

        if (dashboardMode === 'launch') {
          if (action.id === 'careers' || action.id === 'bursaries') score += 3;
          if (action.id === 'tracker') score += 2;
        }

        if (dashboardMode === 'sprint') {
          if (action.id === 'tracker') score += 5;
          if (action.id === 'essay-studio' || action.id === 'cv-builder') score += 3;
        }

        if (completionPct < 100 && action.id === 'careers') score += 2;
        if (overdueApplications.length > 0 && action.id === 'tracker') score += 2;
        if (!isOnline && (action.id === 'bursaries' || action.id === 'institutions')) score -= 3;

        return { ...action, score };
      })
      .sort((a, b) => b.score - a.score);
  }, [completionPct, dashboardMode, isOnline, overdueApplications.length]);

  const handleDailyCheckIn = async () => {
    const result = await checkIn();
    if (!result.ok) {
      toast({
        title: 'Already checked in today',
        description: 'Come back tomorrow to keep your streak alive.',
      });
      return;
    }

    toast({
      title: `Check-in complete (+${result.pointsAwarded} points)`,
      description: `Current streak: ${result.streak} day${result.streak === 1 ? '' : 's'}.`,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome back, {profile.full_name?.split(' ')[0] || 'Learner'}!
          </h1>
          <p className="text-gray-600 mt-1">
            {profile.grade_level ? `${profile.grade_level}` : 'Complete your profile'} 
            {profile.aps_score ? ` • APS Score: ${profile.aps_score}` : ''}
            {profile.province ? ` • ${profile.province}` : ''}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Last data refresh: {lastUpdated ? new Date(lastUpdated).toLocaleString('en-ZA') : 'Unknown'}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium ${modeCopy[dashboardMode].tone}`}>
              <Gauge className="h-3.5 w-3.5" />
              {modeCopy[dashboardMode].title}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-gray-600">
              Variant {experimentVariant}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setDensity((prev) => (prev === 'cozy' ? 'compact' : 'cozy'))}
            className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium"
            title="Toggle dashboard density"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {density === 'cozy' ? 'Compact View' : 'Cozy View'}
          </button>
          {completionPct < 100 && (
            <button
              onClick={() => onNavigate('profile')}
              className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors text-sm font-medium"
            >
              <Target className="w-4 h-4" />
              Complete Profile ({completionPct}%)
            </button>
          )}
        </div>
      </div>

      <div className={`rounded-xl border p-4 mb-6 ${modeCopy[dashboardMode].tone}`}>
        <p className="text-sm font-semibold">{modeCopy[dashboardMode].title}</p>
        <p className="text-sm mt-1 opacity-90">{modeCopy[dashboardMode].subtitle}</p>
      </div>

      <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-green-50 p-5 mb-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Top Picks For You</h2>
            <p className="text-xs text-gray-600">Personalized bursaries that close within the next 30 days.</p>
          </div>
          <button
            onClick={() => onNavigate('bursaries')}
            className="text-xs font-medium px-3 py-1.5 rounded-md border border-blue-200 bg-white text-blue-700 hover:bg-blue-50"
          >
            See all bursaries
          </button>
        </div>

        {personalizedBursaries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {personalizedBursaries.map((item) => {
              const daysLeft = Math.ceil((new Date(item.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate('bursaries')}
                  className="rounded-xl border border-blue-100 bg-white p-3 text-left hover:shadow-sm"
                >
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-1">{item.provider}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">{item.field}</span>
                    <span className="text-amber-700 font-medium">{daysLeft}d left</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No personalized matches this month yet. Complete your profile details for tighter matches.</p>
        )}
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 mb-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-emerald-900">Golden 50 Featured</h3>
            <p className="text-xs text-emerald-800">Curated bursaries manually reviewed for quality and relevance.</p>
          </div>
        </div>
        {goldenBursaries.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {goldenBursaries.map((item) => (
              <span key={item.id} className="text-xs px-2.5 py-1 rounded-full bg-white border border-emerald-200 text-emerald-900">
                {item.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-800 mt-2">No curated Golden 50 records yet. Use Data Lab to mark top bursaries.</p>
        )}
      </div>

      {(overdueApplications.length > 0 || dueSoonApplications.length > 0 || !isOnline) && (
        <div className={`rounded-xl border p-4 mb-6 ${!isOnline ? 'border-slate-300 bg-slate-50 text-slate-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {!isOnline ? (
            <p className="text-sm font-medium flex items-center gap-2">
              <WifiOff className="w-4 h-4" />
              You are offline. Focus on tracker updates and saved resources while sync pauses.
            </p>
          ) : (
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {overdueApplications.length > 0
                ? `${overdueApplications.length} application${overdueApplications.length === 1 ? '' : 's'} overdue. Open tracker first.`
                : `${dueSoonApplications.length} application${dueSoonApplications.length === 1 ? '' : 's'} due within 7 days.`}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('tracker')}
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-current/20 bg-white/70 hover:bg-white"
            >
              Open Tracker
            </button>
            {(updateReady || canInstall) && (
              <span className="px-3 py-1.5 rounded-md text-xs font-medium border border-current/20 bg-white/70">
                {updateReady ? 'Update available' : 'Install app available'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Profile Completion Bar */}
      {completionPct < 100 && (
        <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-2xl p-6 mb-8 border border-blue-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Profile Completion</h3>
            <span className="text-sm font-medium text-blue-700">{completionPct}%</span>
          </div>
          <progress
            max={100}
            value={completionPct}
            className="w-full h-3 mb-3 [&::-webkit-progress-bar]:bg-blue-200 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-gradient-to-r [&::-webkit-progress-value]:from-blue-600 [&::-webkit-progress-value]:to-green-500 [&::-webkit-progress-value]:rounded-full"
          />
          <p className="text-sm text-gray-600">Complete your profile to get personalized career and bursary recommendations.</p>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Prioritized Actions</h2>
        <p className="text-xs text-gray-500">
          Ranked for {modeCopy[dashboardMode].title.toLowerCase()}
        </p>
      </div>
      <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 ${density === 'compact' ? 'gap-3' : 'gap-4'} mb-10`}>
        {prioritizedActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => onNavigate(action.id)}
              className={`bg-white rounded-xl ${density === 'compact' ? 'p-3' : 'p-4'} shadow-sm border transition-all group text-left ${
                experimentVariant === 'B'
                  ? 'border-blue-100 hover:shadow-md hover:border-blue-300'
                  : 'border-gray-100 hover:shadow-md hover:border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                {index < 3 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    Top {index + 1}
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900">{action.label}</p>
              <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{action.note}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Career Recommendations */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Recommended Careers
            </h2>
            <button onClick={() => onNavigate('careers')} className="text-blue-700 text-sm font-medium hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-4">
            {recommendations.map((career, i) => {
              const lmi = getLMISignal(career);

              return (
                <div
                  key={career.id}
                  className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
                  onClick={() => onNavigate('careers')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">#{i + 1} Match</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          career.demandLevel === 'High' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                        }`}>
                          {lmi.signal} Demand
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-sky-50 text-sky-700">
                          Score {lmi.demandScore}/100
                        </span>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg">{career.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{career.field}</p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{career.description}</p>
                      <p className="text-sm font-medium text-green-700 mt-2">{career.salary}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-50 rounded-xl p-5 border border-indigo-100">
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-indigo-700" />
                Momentum Hub
              </h3>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700">
                Level {level}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div className="rounded-lg bg-white border border-indigo-100 px-2 py-2">
                <p className="text-gray-500">Points</p>
                <p className="text-sm font-semibold text-gray-900">{totalPoints}</p>
              </div>
              <div className="rounded-lg bg-white border border-indigo-100 px-2 py-2">
                <p className="text-gray-500">Streak</p>
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-orange-500" /> {currentStreak}
                </p>
              </div>
              <div className="rounded-lg bg-white border border-indigo-100 px-2 py-2">
                <p className="text-gray-500">Best</p>
                <p className="text-sm font-semibold text-gray-900">{longestStreak}</p>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Next level</span>
                <span>{pointsToNextLevel} pts left</span>
              </div>
              <progress
                max={150}
                value={150 - pointsToNextLevel}
                className="w-full h-2 [&::-webkit-progress-bar]:bg-indigo-100 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-indigo-600 [&::-webkit-progress-value]:rounded-full"
              />
            </div>

            <button
              onClick={handleDailyCheckIn}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center justify-center gap-2 ${
                checkedInToday
                  ? 'bg-gray-100 text-gray-500 border-gray-200'
                  : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              {checkedInToday ? 'Checked in today' : 'Daily Check-In (+25)'}
            </button>

            <div className="mt-3">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Badges: {unlockedBadges.length}/{badges.length}
              </p>
              <div className="space-y-1.5">
                {badges.slice(0, 3).map((badge) => (
                  <div key={badge.id} className="text-xs flex items-center justify-between rounded-md bg-white border border-indigo-100 px-2 py-1.5">
                    <span className="text-gray-700">{badge.title}</span>
                    <span className={`font-medium ${badge.unlocked ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {badge.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {recentEvents.length > 0 && (
              <div className="mt-3 pt-3 border-t border-indigo-100">
                <p className="text-xs font-medium text-gray-700 mb-1">Recent activity</p>
                <p className="text-xs text-gray-600">
                  {recentEvents[0].type.replace(/-/g, ' ')} • +{recentEvents[0].points} points
                </p>
              </div>
            )}
          </div>

          {/* Closing Soon Bursaries */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                Closing Soon
              </h2>
              <button onClick={() => onNavigate('bursaries')} className="text-blue-700 text-sm font-medium hover:underline">
                All Bursaries
              </button>
            </div>
            <div className="space-y-3">
              {closingBursaries.map((bursary) => (
                <div
                  key={bursary.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => onNavigate('bursaries')}
                >
                  <h4 className="font-medium text-gray-900 text-sm">{bursary.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{bursary.provider}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                      Closes: {new Date(bursary.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs font-medium text-green-700">{bursary.amount}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500">
                    <p>Source: <span className="font-medium text-gray-700">{getSourceLabel(bursary.verificationSource)}</span></p>
                    <p>{getFreshnessLabel(bursary.lastVerified)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Items */}
          <div className="bg-gradient-to-br from-blue-50 to-green-50 rounded-xl p-5 border border-blue-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-red-500" />
              Your Saved Items
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Saved Bursaries</span>
                <span className="font-medium text-gray-900">{profile.saved_bursaries?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Saved Institutions</span>
                <span className="font-medium text-gray-900">{profile.saved_institutions?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Saved Careers</span>
                <span className="font-medium text-gray-900">{profile.saved_careers?.length || 0}</span>
              </div>
            </div>
          </div>

          {/* Application Tracker */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Application Tracker
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {applications.length} tracked application{applications.length !== 1 ? 's' : ''}
            </p>
            {applications.length === 0 ? (
              <div className="text-sm text-gray-500 space-y-2">
                <p>
                  {dashboardMode === 'launch'
                    ? 'Start by tracking your first bursary to unlock deadline reminders and checklist progress.'
                    : 'Track bursaries from the bursary finder to monitor progress.'}
                </p>
                <button
                  onClick={() => onNavigate('bursaries')}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  Open bursary finder <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.slice(0, 4).map((application) => (
                  <div key={application.id} className="border border-gray-100 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900">
                      {bursaryNameById.get(application.bursaryId) || application.bursaryId}
                    </p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <p className="text-xs text-gray-500">
                        Deadline: {application.deadlineDate ? new Date(application.deadlineDate).toLocaleDateString('en-ZA') : 'N/A'}
                      </p>
                      {(() => {
                        const meta = getDeadlineMeta(application.deadlineDate);
                        return (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${meta.className}`}>
                            {meta.label}
                          </span>
                        );
                      })()}
                    </div>
                    {(() => {
                      const progress = getChecklistProgress(application);
                      return (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[11px] text-gray-600">
                            <span>Checklist progress</span>
                            <span>{progress.completed}/{progress.total}</span>
                          </div>
                          <progress
                            max={100}
                            value={progress.pct}
                            className="mt-1 w-full h-1.5 [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-green-500 [&::-webkit-progress-value]:rounded-full"
                          />
                        </div>
                      );
                    })()}
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={application.status}
                        onChange={(event) => onUpdateApplicationStatus(application.id, event.target.value as Application['status'])}
                        className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1"
                        title="Update application status"
                      >
                        <option value="draft">Draft</option>
                        <option value="submitted">Submitted</option>
                        <option value="under-review">Under Review</option>
                        <option value="successful">Successful</option>
                        <option value="unsuccessful">Unsuccessful</option>
                      </select>
                      <button
                        onClick={() => onRemoveApplication(application.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1 mt-2">
                      {[
                        { key: 'idCopy', label: 'ID' },
                        { key: 'transcript', label: 'Transcript' },
                        { key: 'motivationLetter', label: 'Motivation' },
                        { key: 'references', label: 'References' },
                      ].map((item) => {
                        const typedKey = item.key as 'idCopy' | 'transcript' | 'motivationLetter' | 'references';
                        const completed = !!application.checklist?.[typedKey];
                        return (
                          <button
                            key={item.key}
                            onClick={() => onToggleChecklistItem(application.id, typedKey)}
                            className={`text-[11px] px-2 py-1 rounded border ${
                              completed
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-gray-50 border-gray-200 text-gray-600'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Deadlines */}
          <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
            <h3 className="font-semibold text-orange-900 flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-orange-600" />
              Your Deadlines (30d)
            </h3>
            {overdueApplications.length > 0 && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {overdueApplications.length} tracked application{overdueApplications.length !== 1 ? 's are' : ' is'} overdue.
              </div>
            )}
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-orange-800">No tracked application deadlines in the next 30 days.</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 3).map((item) => (
                  <div key={item.id} className="text-sm text-orange-900">
                    <span className="font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-orange-700" />
                      {bursaryNameById.get(item.bursaryId) || item.bursaryId}
                    </span>
                    <span className="block text-xs text-orange-700">
                      {item.deadlineDate ? new Date(item.deadlineDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No deadline set'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <KnowledgeCards context="dashboard" compact />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
