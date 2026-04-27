import React, { useMemo } from 'react';
import { ArrowLeft, Calendar, Clock, ExternalLink, Heart, Sparkles, GraduationCap, AlertTriangle, Flag, MessageCircle } from 'lucide-react';
import { useBursaries } from '@/hooks/useBursaries';
import type { Bursary } from '@/data/staticData';
import type { UserProfile } from '@/hooks/useAuth';
import KnowledgeCards from '@/components/eduhub/KnowledgeCards';
import { useBursaryFlags } from '@/hooks/useBursaryFlags';
import { toast } from '@/components/ui/use-toast';
import FreshnessBadge from '@/components/eduhub/FreshnessBadge';
import { db } from '@/infrastructure/database/indexeddb/schema';

interface BursaryDetailProps {
  bursaryId: string;
  profile: UserProfile | null;
  onNavigate: (view: string) => void;
  onToggleSave?: (bursaryId: string) => void;
  onTrackApplication?: (bursary: Bursary) => void;
  trackedApplicationBursaryIds?: string[];
}

const FIELD_SUBJECT_MAP: Record<string, string[]> = {
  'Technology & IT': ['Mathematics', 'Information Technology', 'Computer Applications Technology'],
  Engineering: ['Mathematics', 'Physical Sciences', 'Engineering Graphics & Design'],
  Healthcare: ['Life Sciences', 'Physical Sciences', 'Mathematics'],
  'Business & Finance': ['Accounting', 'Business Studies', 'Economics', 'Mathematics'],
  'Business & Commerce': ['Accounting', 'Business Studies', 'Economics', 'Mathematics'],
  Education: ['English Home Language', 'Life Orientation'],
  'Agriculture & Environment': ['Life Sciences', 'Geography', 'Physical Sciences'],
  'Media & Communication': ['English Home Language', 'Dramatic Arts', 'Visual Arts'],
  'Law & Justice': ['English Home Language', 'History'],
  'Creative Arts & Design': ['Visual Arts', 'Dramatic Arts', 'Music'],
  'Trades & Technical': ['Mathematics', 'Physical Sciences', 'Engineering Graphics & Design'],
  STEM: ['Mathematics', 'Physical Sciences', 'Information Technology'],
};

function getDaysLeft(deadline: string) {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function getBursaryMatchSummary(bursary: Bursary, profile: UserProfile | null) {
  const apsRequired = bursary.minAPS ?? 0;
  const apsScore = profile?.aps_score ?? 0;
  const apsDifference = apsScore - apsRequired;
  const fieldSubjects = FIELD_SUBJECT_MAP[bursary.field] || [];
  const takenSubjects = new Set((profile?.subjects || []).map((subject) => subject.name));
  const matchingSubjects = fieldSubjects.filter((subject) => takenSubjects.has(subject));
  const missingSubjects = fieldSubjects.filter((subject) => !takenSubjects.has(subject));

  return {
    apsRequired,
    apsScore,
    apsDifference,
    matchingSubjects,
    missingSubjects,
    subjectFit: fieldSubjects.length === 0 ? 'Unknown' : matchingSubjects.length > 0 ? 'Good match' : 'Review subjects',
  };
}

const BursaryDetail: React.FC<BursaryDetailProps> = ({
  bursaryId,
  profile,
  onNavigate,
  onToggleSave,
  onTrackApplication,
  trackedApplicationBursaryIds = [],
}) => {
  const { bursaries } = useBursaries();
  const { submitFlag } = useBursaryFlags();
  const bursary = useMemo(() => bursaries.find((item) => item.id === bursaryId) || null, [bursaries, bursaryId]);

  if (!bursary) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
          <p className="text-gray-700 font-medium">Bursary not found.</p>
          <button
            onClick={() => onNavigate('bursaries')}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" /> Back to bursaries
          </button>
        </div>
      </div>
    );
  }

  const closingDays = getDaysLeft(bursary.deadline);
  const expired = closingDays < 0;
  const closingSoon = closingDays >= 0 && closingDays <= 30;
  const urgent = closingDays >= 0 && closingDays <= 7;
  const match = getBursaryMatchSummary(bursary, profile);
  const canTrack = !!onTrackApplication;
  const isTracked = trackedApplicationBursaryIds.includes(bursary.id);

  const handleReportOutdated = async () => {
    const reason = window.prompt(
      'Report reason (example: outdated deadline, broken link, inaccurate details):',
      'outdated deadline'
    );

    if (!reason || !reason.trim()) {
      return;
    }

    const details = window.prompt('Optional details for admin review:', '');
    const record = await submitFlag({
      bursaryId: bursary.id,
      bursaryName: bursary.name,
      reason: reason.trim(),
      details: details?.trim() || undefined,
      reporterUserId: profile?.id,
    });

    if (record) {
      await db.bursaries.update(bursary.id, {
        freshnessScore: 0,
        verificationStatus: 'unverified',
      });
      toast({ title: 'Thanks for reporting', description: 'This bursary is now hidden pending review.' });
    } else {
      toast({ title: 'Could not send report', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleShareWhatsApp = () => {
    const shareText = `Check out this bursary: ${bursary.name}. Deadline: ${bursary.deadline}. Apply here: ${window.location.href}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => onNavigate('bursaries')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-5"
      >
        <ArrowLeft className="w-4 h-4" /> Back to bursaries
      </button>

      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gradient-to-br from-green-50 via-white to-blue-50">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full">
                  {bursary.field}
                </span>
                {expired ? (
                  <span className="text-xs font-medium px-2.5 py-1 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Closed
                  </span>
                ) : closingSoon ? (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 ${urgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    <Clock className="w-3 h-3" /> Closing {urgent ? 'this week' : 'soon'}
                  </span>
                ) : null}
                {match.apsDifference >= 0 ? (
                  <span className="text-xs font-medium px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> APS match
                  </span>
                ) : (
                  <span className="text-xs font-medium px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Needs {Math.abs(match.apsDifference)} more APS
                  </span>
                )}
                {bursary.isSponsored ? (
                  <span className="text-xs font-medium px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full">
                    Sponsored by {bursary.sponsorName || bursary.provider}
                  </span>
                ) : null}
              </div>

              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900">{bursary.name}</h1>
              <p className="mt-2 text-gray-600 text-base">{bursary.provider}</p>
              <p className="mt-4 text-gray-700 leading-7">{bursary.description}</p>
            </div>

            <div className="w-full lg:w-72 rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Deadline</p>
                <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  {new Date(bursary.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {expired
                    ? 'This bursary has closed.'
                    : closingSoon
                    ? `Closes in ${closingDays} day${closingDays === 1 ? '' : 's'}.`
                    : `${closingDays} day${closingDays === 1 ? '' : 's'} remaining.`}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Amount</p>
                <p className="text-lg font-semibold text-gray-900">{bursary.amount}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Source</p>
                <p className="text-sm text-gray-700">{bursary.verificationSource || 'seed dataset'}</p>
                <div className="mt-2">
                  <FreshnessBadge
                    lastVerified={bursary.lastVerified}
                    freshnessScore={bursary.freshnessScore}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          <div className="p-6 sm:p-8 space-y-6 border-b lg:border-b-0 lg:border-r border-gray-100">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Eligibility Match</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">APS</p>
                  <p className={`text-sm font-semibold mt-1 ${match.apsDifference >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {match.apsScore}/{match.apsRequired}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Fit</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{match.subjectFit}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Deadline</p>
                  <p className={`text-sm font-semibold mt-1 ${urgent ? 'text-red-700' : closingSoon ? 'text-amber-700' : 'text-gray-900'}`}>
                    {expired ? 'Closed' : closingSoon ? 'Closing soon' : 'Open'}
                  </p>
                </div>
              </div>

              {profile ? (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-900">{match.apsDifference >= 0 ? 'You meet the APS requirement.' : `You need ${Math.abs(match.apsDifference)} more APS.`}</p>
                  {match.matchingSubjects.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Matching subjects</p>
                      <div className="flex flex-wrap gap-2">
                        {match.matchingSubjects.map((subject) => (
                          <span key={subject} className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {match.missingSubjects.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Missing subjects</p>
                      <div className="flex flex-wrap gap-2">
                        {match.missingSubjects.map((subject) => (
                          <span key={subject} className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                  <p className="text-sm text-gray-600">Sign in and complete your profile to see a personalized eligibility match.</p>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Requirements</h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Eligibility</p>
                  <p>{bursary.eligibility}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">What this covers</p>
                  <p>{bursary.amount}</p>
                </div>
              </div>
            </section>
          </div>

          <div className="p-6 sm:p-8 bg-gray-50 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
            <button
              onClick={() => {
                if (onTrackApplication) onTrackApplication(bursary);
              }}
              disabled={!onTrackApplication || isTracked}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                isTracked
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isTracked ? 'Already tracked' : 'Track in application planner'}
            </button>

            {onToggleSave ? (
              <button
                onClick={() => onToggleSave(bursary.id)}
                className="w-full py-3 rounded-lg border border-pink-200 bg-white text-pink-700 hover:bg-pink-50 font-medium flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" /> Save bursary
              </button>
            ) : null}

            <button
              onClick={() => {
                const url = /^https?:\/\//i.test(bursary.link)
                  ? bursary.link
                  : `https://www.google.com/search?q=${encodeURIComponent(`${bursary.provider} ${bursary.name} official bursary application`)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              className="w-full py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Open official source
            </button>

            <button
              onClick={handleReportOutdated}
              className="w-full py-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium flex items-center justify-center gap-2"
            >
              <Flag className="w-4 h-4" /> Report outdated info
            </button>

            <button
              onClick={handleShareWhatsApp}
              className="w-full py-3 rounded-lg border border-green-300 bg-green-50 text-green-800 hover:bg-green-100 font-medium flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> Share via WhatsApp
            </button>

            <KnowledgeCards context="bursary-detail" compact />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BursaryDetail;