import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeAlert,
  BookOpen,
  CalendarClock,
  CheckSquare,
  CircleSlash,
  FileCheck2,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBursaries } from '@/hooks/useBursaries';

interface KnowledgeHubProps {
  onNavigate: (view: string) => void;
  onOpenBursaryDetail?: (bursaryId: string) => void;
}

type TopicCategory = 'All' | 'Bursary Safety' | 'Applications' | 'Documents' | 'Planning' | 'Profile';

interface TopicCard {
  id: string;
  title: string;
  category: Exclude<TopicCategory, 'All'>;
  summary: string;
  whyItMatters: string;
  actionLabel: string;
  actionView?: string;
  icon: LucideIcon;
}

interface ActionStep {
  title: string;
  body: string;
  actionLabel: string;
  view?: string;
  bursaryId?: string;
}

const topicCards: TopicCard[] = [
  {
    id: 'fee-check',
    title: 'Never pay to apply',
    category: 'Bursary Safety',
    summary: 'A real bursary should not ask for money just to unlock the form.',
    whyItMatters: 'This is the fastest way to avoid scam pages and fake submission portals.',
    actionLabel: 'Review bursary safety',
    actionView: 'bursaries',
    icon: ShieldAlert,
  },
  {
    id: 'aps-check',
    title: 'APS and subject fit',
    category: 'Profile',
    summary: 'Compare your APS score and subject mix against the field before you apply.',
    whyItMatters: 'You save time by only pursuing bursaries that align with your current profile.',
    actionLabel: 'Open bursary finder',
    actionView: 'bursaries',
    icon: Target,
  },
  {
    id: 'document-pack',
    title: 'Document pack',
    category: 'Documents',
    summary: 'Keep ID, results, proof of income, and recommendation letters ready in one folder.',
    whyItMatters: 'The last thing you want is to miss a deadline because one document is still missing.',
    actionLabel: 'Go to tracker',
    actionView: 'tracker',
    icon: FileCheck2,
  },
  {
    id: 'deadline-buffer',
    title: 'Deadline buffer',
    category: 'Planning',
    summary: 'Work to an internal deadline at least 7 days before the public close date.',
    whyItMatters: 'Internet delays, uploads, and forgotten attachments are most common on the final day.',
    actionLabel: 'Plan deadlines',
    actionView: 'tracker',
    icon: CalendarClock,
  },
  {
    id: 'form-order',
    title: 'Application sequence',
    category: 'Applications',
    summary: 'Profile check first, then documents, then the submission itself.',
    whyItMatters: 'A consistent sequence reduces mistakes and helps you reuse the same workflow every time.',
    actionLabel: 'Open application tracker',
    actionView: 'tracker',
    icon: CheckSquare,
  },
  {
    id: 'fallback-plan',
    title: 'Funding fallback',
    category: 'Planning',
    summary: 'Apply to more than one opportunity instead of depending on a single result.',
    whyItMatters: 'A backup option keeps a missed deadline from becoming a dead end.',
    actionLabel: 'Browse more bursaries',
    actionView: 'bursaries',
    icon: Sparkles,
  },
  {
    id: 'verification-check',
    title: 'Verification dates',
    category: 'Bursary Safety',
    summary: 'Prefer opportunities that have recent verification dates and clear sources.',
    whyItMatters: 'Fresh listings are more likely to still be open and less likely to be duplicated misinformation.',
    actionLabel: 'Check source freshness',
    actionView: 'bursaries',
    icon: ShieldAlert,
  },
  {
    id: 'cv-primer',
    title: 'CV starter thinking',
    category: 'Documents',
    summary: 'Keep a clean summary of achievements, subjects, and volunteer work ready for later use.',
    whyItMatters: 'This gives you strong source material when drafting application essays in Essay Studio.',
    actionLabel: 'Open Essay Studio',
    actionView: 'essay-studio',
    icon: BookOpen,
  },
];

const categoryOptions: TopicCategory[] = ['All', 'Bursary Safety', 'Applications', 'Documents', 'Planning', 'Profile'];

function getDaysLeft(deadline: string) {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function getProfileCompletionPct(profile: ReturnType<typeof useAuth>['profile']) {
  if (!profile) return 0;
  const fields = [profile.grade_level, profile.subjects?.length, profile.career_interests?.length, profile.province];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

const KnowledgeHub: React.FC<KnowledgeHubProps> = ({ onNavigate, onOpenBursaryDetail }) => {
  const { profile } = useAuth();
  const { bursaries } = useBursaries();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<TopicCategory>('All');

  const profileCompletionPct = getProfileCompletionPct(profile);
  const savedCount = profile?.saved_bursaries?.length || 0;

  const openBursaries = useMemo(
    () => bursaries.filter((bursary) => new Date(bursary.deadline).getTime() >= Date.now()),
    [bursaries]
  );

  const closingSoonBursaries = useMemo(
    () => openBursaries.filter((bursary) => getDaysLeft(bursary.deadline) <= 14).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()).slice(0, 3),
    [openBursaries]
  );

  const featuredBursary = closingSoonBursaries[0] || openBursaries[0] || null;

  const actionStep: ActionStep = useMemo(() => {
    if (!profile) {
      return {
        title: 'Personalize the hub',
        body: 'Sign in so this page can use your subjects, APS score, and saved bursaries to prioritize what matters next.',
        actionLabel: 'Browse bursaries',
        view: 'bursaries',
      };
    }

    if (profileCompletionPct < 100) {
      return {
        title: 'Complete your profile first',
        body: `You are ${profileCompletionPct}% complete. Fill in the missing profile fields so the hub can match bursaries to your real strengths.`,
        actionLabel: 'Finish profile',
        view: 'profile',
      };
    }

    if (featuredBursary) {
      return {
        title: `Act on ${closingSoonBursaries.length} bursary${closingSoonBursaries.length === 1 ? '' : 'ies'} closing soon`,
        body: `${featuredBursary.name} is the next deadline to watch. ${getDaysLeft(featuredBursary.deadline)} day${getDaysLeft(featuredBursary.deadline) === 1 ? '' : 's'} remain before it closes.`,
        actionLabel: onOpenBursaryDetail ? 'Open next bursary' : 'Browse bursaries',
        view: 'bursaries',
        bursaryId: featuredBursary.id,
      };
    }

    if (savedCount === 0) {
      return {
        title: 'Build a shortlist',
        body: 'Save a few bursaries now so you can compare eligibility, deadlines, and fit without starting from zero each time.',
        actionLabel: 'Find bursaries',
        view: 'bursaries',
      };
    }

    return {
      title: 'Move to execution',
      body: 'Your profile is ready. Use the tracker to turn saved opportunities into tracked applications with deadlines and checklists.',
      actionLabel: 'Open tracker',
      view: 'tracker',
    };
  }, [closingSoonBursaries, featuredBursary, onOpenBursaryDetail, profile, profileCompletionPct, savedCount]);

  const recommendedTopics = useMemo(() => {
    const scored = [...topicCards].map((topic) => {
      let score = 0;

      if (profileCompletionPct < 100) {
        if (topic.category === 'Profile') score += 6;
        if (topic.category === 'Documents') score += 4;
      }

      if (closingSoonBursaries.length > 0) {
        if (topic.category === 'Planning') score += 6;
        if (topic.category === 'Applications') score += 5;
        if (topic.category === 'Bursary Safety') score += 4;
      }

      if (savedCount > 0) {
        if (topic.category === 'Applications') score += 3;
        if (topic.category === 'Planning') score += 2;
      }

      if (topic.id === 'cv-primer' && profileCompletionPct === 100) score += 2;

      return { topic, score };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((item) => item.topic);
  }, [closingSoonBursaries.length, profileCompletionPct, savedCount]);

  const filteredTopics = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();

    return topicCards.filter((topic) => {
      const matchesSearch =
        normalized === '' ||
        topic.title.toLowerCase().includes(normalized) ||
        topic.summary.toLowerCase().includes(normalized) ||
        topic.whyItMatters.toLowerCase().includes(normalized);
      const matchesCategory = categoryFilter === 'All' || topic.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-slate-900 via-blue-900 to-emerald-800 text-white shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-0">
          <div className="p-6 sm:p-10 lg:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase text-white/80">
              <Sparkles className="w-3.5 h-3.5" />
              Hidden curriculum
            </div>
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">Knowledge Hub</h1>
            <p className="mt-4 max-w-2xl text-sm sm:text-base leading-7 text-white/80">
              Practical bursary habits, profile checks, and deadline tactics collected in one place. The hub adapts to
              your profile and the live bursary list, so the next step is always obvious.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                {profile ? `${profileCompletionPct}% profile complete` : 'No profile loaded'}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                {openBursaries.length} open bursary{openBursaries.length === 1 ? '' : 'ies'}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                {closingSoonBursaries.length} closing soon
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                {savedCount} saved bursary{savedCount === 1 ? '' : 'ies'}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Your next move</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{actionStep.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/80">{actionStep.body}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (actionStep.bursaryId && onOpenBursaryDetail) {
                      onOpenBursaryDetail(actionStep.bursaryId);
                      return;
                    }

                    if (actionStep.view) {
                      onNavigate(actionStep.view);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  {actionStep.actionLabel}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate('resources')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15"
                >
                  <BookOpen className="w-4 h-4" />
                  Open resource guides
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-white/8 p-6 sm:p-10 lg:border-l lg:border-t-0 lg:p-12">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Focus</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {profileCompletionPct < 100 ? 'Profile first' : 'Execution ready'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Upcoming</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {closingSoonBursaries.length > 0 ? `${closingSoonBursaries.length} deadline${closingSoonBursaries.length === 1 ? '' : 's'}` : 'No rush'}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Saved</p>
                <p className="mt-1 text-lg font-semibold text-white">{savedCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Open</p>
                <p className="mt-1 text-lg font-semibold text-white">{openBursaries.length}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white p-4 text-gray-900 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Live bursary watch</p>
                  <h3 className="text-base font-semibold text-gray-900 mt-1">What to check next</h3>
                </div>
                <BadgeAlert className="w-5 h-5 text-blue-600" />
              </div>

              {closingSoonBursaries.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {closingSoonBursaries.map((bursary) => (
                    <div key={bursary.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900">{bursary.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{bursary.provider}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700">
                          {getDaysLeft(bursary.deadline)}d left
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">
                          <p>Deadline: {new Date(bursary.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</p>
                          <p>{bursary.amount}</p>
                        </div>
                        <button
                          onClick={() => {
                            if (onOpenBursaryDetail) {
                              onOpenBursaryDetail(bursary.id);
                              return;
                            }
                            onNavigate('bursaries');
                          }}
                          className="text-xs font-semibold text-blue-700 hover:underline"
                        >
                          Open bursary
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 leading-6">
                  No bursaries are closing in the next two weeks. Use this window to improve your profile and prepare
                  documents before the next deadline wave.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Recommended for you</h2>
            <p className="text-sm text-gray-600 mt-1">These topics float to the top based on your profile and live bursary pressure.</p>
          </div>
          <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
            {profileCompletionPct < 100 ? 'Profile gaps first' : closingSoonBursaries.length > 0 ? 'Deadline pressure active' : 'Execution mode'}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendedTopics.map((topic) => {
            const Icon = topic.icon;
            const reason =
              topic.category === 'Profile' && profileCompletionPct < 100
                ? 'This is the fastest way to improve your recommendations.'
                : topic.category === 'Planning' && closingSoonBursaries.length > 0
                ? 'Deadline pressure makes this more important right now.'
                : topic.category === 'Applications'
                ? 'You are close to the point where execution matters most.'
                : 'Useful whenever you need to keep the workflow clean.';

            return (
              <article key={topic.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                      <Icon className="w-4 h-4" />
                      {topic.category}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900">{topic.title}</h3>
                  </div>
                  <div className="rounded-xl bg-white p-2 text-gray-500 border border-gray-200">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <p className="mt-3 text-sm text-gray-700 leading-6">{topic.summary}</p>
                <div className="mt-4 rounded-xl bg-white border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Why it matters</p>
                  <p className="mt-1 text-sm text-gray-700 leading-6">{reason}</p>
                </div>

                <button
                  onClick={() => topic.actionView && onNavigate(topic.actionView)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {topic.actionLabel}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Browse topics</h2>
            <p className="text-sm text-gray-600 mt-1">Search by concept or filter by the part of the application process you want to improve.</p>
          </div>
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search tips, documents, or planning habits..."
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {categoryOptions.map((option) => (
            <button
              key={option}
              onClick={() => setCategoryFilter(option)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                categoryFilter === option
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {option}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTopics.map((topic) => {
            const Icon = topic.icon;

            return (
              <article key={topic.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200">
                      <Icon className="w-4 h-4" />
                      {topic.category}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900">{topic.title}</h3>
                  </div>
                  <div className="rounded-xl bg-white p-2 text-gray-500 border border-gray-200">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <p className="mt-3 text-sm text-gray-700 leading-6">{topic.summary}</p>
                <div className="mt-4 rounded-xl bg-white border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Why it matters</p>
                  <p className="mt-1 text-sm text-gray-700 leading-6">{topic.whyItMatters}</p>
                </div>

                <button
                  onClick={() => topic.actionView && onNavigate(topic.actionView)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {topic.actionLabel}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </article>
            );
          })}
        </div>

        {filteredTopics.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <CircleSlash className="mx-auto w-10 h-10 text-gray-300" />
            <h3 className="mt-3 text-lg font-semibold text-gray-900">No topics matched</h3>
            <p className="mt-1 text-sm text-gray-600">Try a different keyword or reset the category filter.</p>
          </div>
        ) : null}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-2 text-amber-800 font-semibold">
            <TriangleAlert className="w-4 h-4" />
            Scam checks
          </div>
          <p className="mt-2 text-sm text-amber-900 leading-6">
            If a bursary asks for a payment, pressures you to share banking details, or hides the source, back out and verify the record from another route.
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-center gap-2 text-blue-800 font-semibold">
            <BadgeAlert className="w-4 h-4" />
            Next-step readiness
          </div>
          <p className="mt-2 text-sm text-blue-900 leading-6">
            CV Builder, ATS scoring, and Essay Studio are now live. Keep refining your drafts, track your score trend, and connect your essays to real bursary prompts.
          </p>
        </div>
      </section>
    </div>
  );
};

export default KnowledgeHub;