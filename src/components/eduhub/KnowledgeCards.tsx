import React from 'react';
import {
  Banknote,
  BookOpen,
  Clock3,
  FileCheck2,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

type KnowledgeContext = 'bursary-detail' | 'tracker' | 'dashboard';

interface KnowledgeCardsProps {
  context: KnowledgeContext;
  compact?: boolean;
}

interface KnowledgeCardItem {
  title: string;
  body: string;
  icon: LucideIcon;
  tone: string;
}

const knowledgeContent: Record<KnowledgeContext, { eyebrow: string; title: string; description: string; cards: KnowledgeCardItem[] }> = {
  'bursary-detail': {
    eyebrow: 'Hidden curriculum',
    title: 'What experienced applicants check before they apply',
    description: 'Small process habits make bursary applications easier to submit and easier to verify.',
    cards: [
      {
        title: 'Never pay to apply',
        body: 'A legitimate bursary should not ask for an application fee. If a site pushes payment first, verify the source before continuing.',
        icon: ShieldAlert,
        tone: 'bg-red-50 text-red-700 border-red-100',
      },
      {
        title: 'Prepare one clean PDF per document',
        body: 'Keep ID, results, proof of income, and recommendation letters in clearly named files so you can reuse them across bursaries.',
        icon: FileCheck2,
        tone: 'bg-blue-50 text-blue-700 border-blue-100',
      },
      {
        title: 'Treat the deadline as earlier than listed',
        body: 'Submit at least a week before close date. Website delays, missing attachments, and slow internet can easily wipe out the final day.',
        icon: Clock3,
        tone: 'bg-amber-50 text-amber-700 border-amber-100',
      },
    ],
  },
  tracker: {
    eyebrow: 'Hidden curriculum',
    title: 'The rules behind a strong application queue',
    description: 'Use the tracker to standardize how each bursary gets submitted, reviewed, and followed up.',
    cards: [
      {
        title: 'Submit in the right order',
        body: 'A practical flow is: profile check, documents, application submission, then reminder setup and follow-up.',
        icon: Sparkles,
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
      {
        title: 'Checklist items matter more than status labels',
        body: 'An application can look active while still missing a transcript or motivation letter. Finish the checklist before moving on.',
        icon: FileCheck2,
        tone: 'bg-blue-50 text-blue-700 border-blue-100',
      },
      {
        title: 'Deadlines should trigger action, not panic',
        body: 'Use the 7-day window to gather final documents, then follow with a 3-day reminder to confirm submission details.',
        icon: Clock3,
        tone: 'bg-amber-50 text-amber-700 border-amber-100',
      },
    ],
  },
  dashboard: {
    eyebrow: 'Hidden curriculum',
    title: 'Fast checks before you press apply',
    description: 'The dashboard keeps the practical application habits visible without opening a bursary record.',
    cards: [
      {
        title: 'Check APS and subjects first',
        body: 'A bursary can look attractive but still miss your subject mix. Review the requirement against your profile before saving time on the form.',
        icon: BookOpen,
        tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      },
      {
        title: 'Verify the source date',
        body: 'Freshness matters. A record that was verified recently is easier to trust than one copied from an old post or expired notice.',
        icon: Sparkles,
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      },
      {
        title: 'Keep a funding fallback',
        body: 'Strong applicants usually apply to more than one bursary so one missed deadline does not end the cycle.',
        icon: Banknote,
        tone: 'bg-orange-50 text-orange-700 border-orange-100',
      },
    ],
  },
};

const KnowledgeCards: React.FC<KnowledgeCardsProps> = ({ context, compact = false }) => {
  const content = knowledgeContent[context];

  return (
    <section className={`rounded-2xl border border-gray-200 ${compact ? 'bg-white' : 'bg-gradient-to-br from-slate-50 to-white'} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{content.eyebrow}</p>
          <h3 className="text-base font-semibold text-gray-900 mt-1">{content.title}</h3>
          {!compact ? <p className="text-sm text-gray-600 mt-1 leading-6">{content.description}</p> : null}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'gap-4 sm:grid-cols-3'}`}>
        {content.cards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.title} className={`rounded-xl border p-3 sm:p-4 ${card.tone}`}>
              <div className="flex items-start gap-2">
                <div className="mt-0.5 rounded-lg bg-white/80 p-1.5 shadow-sm">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900">{card.title}</h4>
                  <p className="text-sm text-gray-700 mt-1 leading-6">{card.body}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default KnowledgeCards;
