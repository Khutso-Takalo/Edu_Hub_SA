import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Award, Calendar, DollarSign, GraduationCap, Heart,
  ExternalLink, ChevronDown, ChevronUp, Clock, AlertCircle, Loader2, SlidersHorizontal, Flag
} from 'lucide-react';
import { useBursaries } from '@/hooks/useBursaries';
import type { Bursary } from '@/data/staticData';
import type { UserProfile } from '@/hooks/useAuth';
import { useBursaryFlags } from '@/hooks/useBursaryFlags';
import { toast } from '@/components/ui/use-toast';
import FreshnessBadge from '@/components/eduhub/FreshnessBadge';
import { searchBursaries } from '@/lib/intelligentSearch';
import { buildHighlightTerms, getMatchLabel, highlightText } from '@/lib/searchPresentation';

interface BursarySearchProps {
  profile: UserProfile | null;
  onToggleSave?: (bursaryId: string) => void;
  onTrackApplication?: (bursary: Bursary) => void;
  onViewDetails?: (bursaryId: string) => void;
  trackedApplicationBursaryIds?: string[];
  initialSearch?: string;
}

const FILTERS_STORAGE_KEY = 'eduhub:bursary-filters:v1';
const SEARCH_KPI_STORAGE_KEY = 'eduhub:search-kpi:v1';

interface StoredFilters {
  searchQuery: string;
  fieldFilter: string;
  sortBy: string;
  openOnly: boolean;
  closingSoonOnly: boolean;
}

function readStoredFilters(): StoredFilters {
  try {
    const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) {
      return {
        searchQuery: '',
        fieldFilter: 'all',
        sortBy: 'deadline',
        openOnly: false,
        closingSoonOnly: false,
      };
    }

    const parsed = JSON.parse(raw) as Partial<StoredFilters>;
    return {
      searchQuery: parsed.searchQuery || '',
      fieldFilter: parsed.fieldFilter || 'all',
      sortBy: parsed.sortBy || 'deadline',
      openOnly: !!parsed.openOnly,
      closingSoonOnly: !!parsed.closingSoonOnly,
    };
  } catch {
    return {
      searchQuery: '',
      fieldFilter: 'all',
      sortBy: 'deadline',
      openOnly: false,
      closingSoonOnly: false,
    };
  }
}

function writeSearchKpiEntry(entry: {
  queryLength: number;
  timeToFirstResultMs: number;
  resultCount: number;
  timestamp: string;
}) {
  try {
    const raw = localStorage.getItem(SEARCH_KPI_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as typeof entry[]) : [];
    const next = [entry, ...parsed].slice(0, 100);
    localStorage.setItem(SEARCH_KPI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore KPI write errors to avoid impacting user flow.
  }
}

const BursarySearch: React.FC<BursarySearchProps> = ({
  profile,
  onToggleSave,
  onTrackApplication,
  onViewDetails,
  trackedApplicationBursaryIds = [],
  initialSearch = ''
}) => {
  const { bursaries, loading, error, refresh } = useBursaries();
  const { submitFlag } = useBursaryFlags();
  const storedFilters = useMemo(readStoredFilters, []);
  const [searchQuery, setSearchQuery] = useState(initialSearch || storedFilters.searchQuery);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialSearch || storedFilters.searchQuery);
  const [fieldFilter, setFieldFilter] = useState<string>(storedFilters.fieldFilter);
  const [sortBy, setSortBy] = useState<string>(storedFilters.sortBy);
  const [openOnly, setOpenOnly] = useState<boolean>(storedFilters.openOnly);
  const [closingSoonOnly, setClosingSoonOnly] = useState<boolean>(storedFilters.closingSoonOnly);
  const [expandedBursary, setExpandedBursary] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const firstSearchInputAtRef = useRef<number | null>(null);
  const lastLoggedQueryRef = useRef<string>('');

  useEffect(() => {
    if (!initialSearch) return;
    setSearchQuery(initialSearch);
    setDebouncedSearchQuery(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({ searchQuery, fieldFilter, sortBy, openOnly, closingSoonOnly })
    );
  }, [searchQuery, fieldFilter, sortBy, openOnly, closingSoonOnly]);

  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      firstSearchInputAtRef.current = null;
      return;
    }

    if (firstSearchInputAtRef.current === null) {
      firstSearchInputAtRef.current = performance.now();
    }
  }, [searchQuery]);

  const isClosingSoon = (deadline: string) => {
    const diff = new Date(deadline).getTime() - new Date().getTime();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  };

  const isExpired = (deadline: string) => new Date(deadline) < new Date();

  const fields = useMemo(() => {
    return [...new Set(bursaries.map(b => b.field))];
  }, [bursaries]);

  const { filteredBursaryResults, filterDurationMs, topMatchScore } = useMemo(() => {
    const start = performance.now();
    const ranked = debouncedSearchQuery.trim()
      ? searchBursaries(bursaries, debouncedSearchQuery, {
          limit: 100,
          urgency: closingSoonOnly || /deadline|closing|urgent|apply|submit/i.test(debouncedSearchQuery),
        })
      : bursaries.map((bursary) => ({ item: bursary, score: 0, matchedTokens: [] as string[] }));

    const filtered = ranked
      .filter((result) => {
        const bursary = result.item;
        const matchesField = fieldFilter === 'all' || bursary.field === fieldFilter;
        const matchesOpen = !openOnly || new Date(bursary.deadline) >= new Date();
        const matchesClosingSoon = !closingSoonOnly || isClosingSoon(bursary.deadline);
        return matchesField && matchesOpen && matchesClosingSoon;
      })
      .sort((a, b) => {
        if (sortBy === 'deadline') {
          const aDays = new Date(a.item.deadline).getTime();
          const bDays = new Date(b.item.deadline).getTime();
          const deadlineDiff = aDays - bDays;
          if (deadlineDiff !== 0) return deadlineDiff;
        }
        if (sortBy === 'name') {
          return a.item.name.localeCompare(b.item.name);
        }
        if (sortBy === 'amount') {
          return (b.item.amount || '').localeCompare(a.item.amount || '');
        }

        const aFreshness = a.item.freshnessScore ?? 0;
        const bFreshness = b.item.freshnessScore ?? 0;
        return bFreshness - aFreshness;
      });

    const end = performance.now();
    return {
      filteredBursaryResults: filtered,
      filterDurationMs: Math.round((end - start) * 10) / 10,
      topMatchScore: ranked[0]?.score ?? 0,
    };
  }, [bursaries, debouncedSearchQuery, fieldFilter, sortBy, openOnly, closingSoonOnly]);

  const filteredBursaries = filteredBursaryResults.map((result) => result.item);

  useEffect(() => {
    const normalized = debouncedSearchQuery.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    if (filteredBursaries.length === 0) {
      return;
    }

    if (lastLoggedQueryRef.current === normalized) {
      return;
    }

    const startedAt = firstSearchInputAtRef.current;
    if (startedAt === null) {
      return;
    }

    writeSearchKpiEntry({
      queryLength: normalized.length,
      timeToFirstResultMs: Math.round(performance.now() - startedAt),
      resultCount: filteredBursaries.length,
      timestamp: new Date().toISOString(),
    });

    lastLoggedQueryRef.current = normalized;
  }, [debouncedSearchQuery, filteredBursaries]);
  const activeFilterCount =
    (fieldFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'deadline' ? 1 : 0) +
    (openOnly ? 1 : 0) +
    (closingSoonOnly ? 1 : 0);

  const quickFieldPresets = ['All Fields', 'Engineering', 'STEM', 'Technology & IT', 'Business & Finance'];

  const getSourceLabel = (bursary: Bursary) => {
    if (bursary.verificationSource === 'official') return 'Official Source';
    if (bursary.verificationSource === 'scraped') return 'Scraped Source';
    if (bursary.verificationSource === 'community') return 'Community Submitted';
    return 'Seed Dataset';
  };

  const getFreshnessLabel = (bursary: Bursary) => {
    if (!bursary.lastVerified) return 'Verification pending';

    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(bursary.lastVerified).getTime()) / (24 * 60 * 60 * 1000))
    );

    if (days === 0) return 'Verified today';
    if (days === 1) return 'Verified 1 day ago';
    return `Verified ${days} days ago`;
  };

  const resolveApplyTarget = (bursary: Bursary) => {
    const isDirect = /^https?:\/\//i.test(bursary.link);
    if (isDirect) {
      return { url: bursary.link, direct: true };
    }

    const query = encodeURIComponent(`${bursary.provider} ${bursary.name} bursary application official site`);
    return { url: `https://www.google.com/search?q=${query}`, direct: false };
  };

  const handleApplyNow = (bursary: Bursary) => {
    const target = resolveApplyTarget(bursary);
    const warning = target.direct
      ? 'You are leaving EduHub to apply on an external site. Verify the URL and never pay to apply. Continue?'
      : 'No direct application URL was available. We will open an official-site search so you can verify the source. Continue?';

    if (!window.confirm(warning)) {
      return;
    }

    window.open(target.url, '_blank', 'noopener,noreferrer');
  };

  const handleReportOutdated = async (bursary: Bursary) => {
    const reason = window.prompt(
      'Report reason (example: deadline passed, broken link, duplicate, inaccurate requirements):',
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
      toast({ title: 'Thanks for the report', description: 'This bursary was flagged for admin review.' });
    } else {
      toast({ title: 'Could not submit report', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const qualifies = (bursary: Bursary) => {
    if (!profile?.aps_score || !bursary.minAPS) return null;
    return profile.aps_score >= bursary.minAPS;
  };

  const isSaved = (id: string) => profile?.saved_bursaries?.includes(id) || false;

  const isTracked = (id: string) => trackedApplicationBursaryIds.includes(id);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-4" />
        <p className="text-gray-600">Loading bursaries...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Failed to load bursaries. Please refresh the page.</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 text-white" />
          </div>
          Bursary Finder
        </h1>
        <p className="mt-2 text-gray-600">
          Discover funding opportunities for your studies across South Africa
        </p>
      </div>

      {/* APS Eligibility Banner */}
      {profile?.aps_score ? (
        <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200 flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-blue-700 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            Your APS Score: <strong>{profile.aps_score}</strong> — Bursaries you qualify for are highlighted in green.
          </p>
        </div>
      ) : null}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-8">
        <div className="space-y-3">
          <div className="relative flex-1">
            <label htmlFor="bursary-search-input" className="sr-only">Search bursaries</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="bursary-search-input"
              type="text"
              placeholder="Search bursaries by name, provider, or field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>

          <button
            onClick={() => setShowMobileFilters((prev) => !prev)}
            className="sm:hidden w-full px-4 py-2.5 border border-gray-300 rounded-lg flex items-center justify-between text-sm font-medium text-gray-700"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4" />
              Filters & Sorting
            </span>
            <span className="text-xs text-gray-500">
              {activeFilterCount > 0 ? `${activeFilterCount} active` : 'Default'}
            </span>
          </button>

          <div className={`${showMobileFilters ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-2 gap-4`}>
          <div className="space-y-2">
          <label htmlFor="bursary-field-filter" className="text-xs text-gray-500">Field</label>
          <select
            id="bursary-field-filter"
            value={fieldFilter}
            onChange={(e) => setFieldFilter(e.target.value)}
            title="Filter by field"
            aria-label="Filter bursaries by field"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
          >
            <option value="all">All Fields</option>
            {fields.map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          </div>
          <div className="space-y-2">
          <label htmlFor="bursary-sort-by" className="text-xs text-gray-500">Sort</label>
          <select
            id="bursary-sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            title="Sort bursaries"
            aria-label="Sort bursaries by"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
          >
            <option value="deadline">Sort by Deadline</option>
            <option value="name">Sort by Name</option>
            <option value="amount">Sort by Amount</option>
          </select>
          </div>
          <label className="sm:col-span-2 flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer select-none">
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="text-sm text-gray-700">Show only open opportunities</span>
          </label>
          <label className="sm:col-span-2 flex items-center gap-3 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer select-none">
            <input
              type="checkbox"
              checked={closingSoonOnly}
              onChange={(e) => setClosingSoonOnly(e.target.checked)}
              className="h-4 w-4"
              aria-label="Show only closing soon opportunities"
            />
            <span className="text-sm text-gray-700">Show only closing soon (30 days)</span>
          </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {quickFieldPresets.map((preset) => {
              const value = preset === 'All Fields' ? 'all' : preset;
              const active = fieldFilter === value;
              return (
                <button
                  key={preset}
                  onClick={() => setFieldFilter(value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    active
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-gray-500" aria-live="polite">
          <p>
            {filteredBursaries.length} bursary{filteredBursaries.length !== 1 ? 'ies' : 'y'} found
          </p>
          <div className="flex items-center gap-3">
            <p className="text-xs">
              {searchQuery !== debouncedSearchQuery ? 'Updating...' : `Updated in ${filterDurationMs} ms`}
            </p>
            {(searchQuery !== '' || activeFilterCount > 0) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDebouncedSearchQuery('');
                  setFieldFilter('all');
                  setSortBy('deadline');
                  setOpenOnly(false);
                  setClosingSoonOnly(false);
                }}
                className="text-xs text-blue-700 hover:underline"
              >
                Reset to defaults
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bursary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredBursaryResults.map((result) => {
          const bursary = result.item;
          const qualified = qualifies(bursary);
          const closing = isClosingSoon(bursary.deadline);
          const expired = isExpired(bursary.deadline);
          const terms = buildHighlightTerms(debouncedSearchQuery, result.matchedTokens);

          return (
            <div
              key={bursary.id}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all ${
                qualified === true
                  ? 'border-green-200'
                  : qualified === false
                  ? 'border-gray-200'
                  : 'border-gray-100'
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 rounded-full">
                        {bursary.field}
                      </span>
                      {closing && !expired && (
                        <span className="text-xs font-medium px-2.5 py-1 bg-orange-50 text-orange-700 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Closing Soon
                        </span>
                      )}
                      {expired && (
                        <span className="text-xs font-medium px-2.5 py-1 bg-red-50 text-red-700 rounded-full">
                          Closed
                        </span>
                      )}
                      {qualified === true && (
                        <span className="text-xs font-medium px-2.5 py-1 bg-green-100 text-green-800 rounded-full">
                          You Qualify
                        </span>
                      )}
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{highlightText(bursary.name, terms)}</h3>
                      {debouncedSearchQuery.trim() ? (
                        <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                          {getMatchLabel(result.score, topMatchScore)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{highlightText(bursary.provider, terms)}</p>
                    {bursary.isSponsored ? (
                      <p className="text-xs inline-flex mt-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Sponsored by {bursary.sponsorName || bursary.provider}
                      </p>
                    ) : null}
                    <div className="mt-2">
                      <FreshnessBadge
                        lastVerified={bursary.lastVerified}
                        freshnessScore={bursary.freshnessScore}
                      />
                    </div>
                  </div>
                  {onToggleSave && (
                    <button
                      onClick={() => onToggleSave(bursary.id)}
                      title={isSaved(bursary.id) ? 'Remove from saved' : 'Save bursary'}
                      className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                        isSaved(bursary.id)
                          ? 'text-red-500 bg-red-50'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <Heart className={`w-5 h-5 ${isSaved(bursary.id) ? 'fill-current' : ''}`} />
                    </button>
                  )}
                </div>

                <p className="text-sm text-gray-600 line-clamp-2 mb-4">{highlightText(bursary.description, terms)}</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">{bursary.amount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-600">
                      {new Date(bursary.deadline).toLocaleDateString('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-500 space-y-1 mb-3">
                  <p>
                    Source: <span className="font-medium text-gray-700">{getSourceLabel(bursary)}</span>
                  </p>
                  <p>
                    Last Updated: <span className="font-medium text-gray-700">{getFreshnessLabel(bursary)}</span>
                  </p>
                </div>

                <button
                  onClick={() =>
                    setExpandedBursary(expandedBursary === bursary.id ? null : bursary.id)
                  }
                  title={expandedBursary === bursary.id ? 'Show less details' : 'Show more details'}
                  className="text-blue-700 text-sm font-medium hover:underline flex items-center gap-1"
                >
                  {expandedBursary === bursary.id ? 'Less Details' : 'More Details'}
                  {expandedBursary === bursary.id ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {expandedBursary === bursary.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Eligibility
                      </p>
                      <p className="text-sm text-gray-700">{bursary.eligibility}</p>
                    </div>
                    {(bursary.minAPS ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Minimum APS
                        </p>
                        <p className="text-sm text-gray-700">{bursary.minAPS}</p>
                      </div>
                    )}
                    <button
                      onClick={() => handleApplyNow(bursary)}
                      className="w-full py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {/^https?:\/\//i.test(bursary.link)
                        ? 'Apply Now (Verified External Link)'
                        : 'Find Official Application Link'}
                    </button>
                    {onTrackApplication && (
                      <button
                        onClick={() => onTrackApplication(bursary)}
                        disabled={isTracked(bursary.id)}
                        className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors ${
                          isTracked(bursary.id)
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {isTracked(bursary.id) ? 'Tracked in Dashboard' : 'Track Application'}
                      </button>
                    )}
                    {onViewDetails && (
                      <button
                        onClick={() => onViewDetails(bursary.id)}
                        className="w-full py-2.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        View bursary details
                      </button>
                    )}
                    <button
                      onClick={() => handleReportOutdated(bursary)}
                      className="w-full py-2.5 text-sm font-medium rounded-lg border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 flex items-center justify-center gap-2"
                    >
                      <Flag className="w-4 h-4" /> Report outdated info
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredBursaries.length === 0 && !loading && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No verified bursaries available</h3>
          <p className="text-gray-500 mt-1">Try adjusting your search or filters, or refresh when new verified records are seeded</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setDebouncedSearchQuery('');
              setFieldFilter('all');
              setSortBy('deadline');
              setOpenOnly(false);
              setClosingSoonOnly(false);
            }}
            className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};

export default BursarySearch;