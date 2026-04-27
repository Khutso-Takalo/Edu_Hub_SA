import React, { useEffect, useMemo } from 'react';
import { Search, Award, Building2, Briefcase, FileText, ArrowRight, X, AlertTriangle, Sparkles } from 'lucide-react';
import { careers, pastPapers } from '@/data/staticData';
import { getLMISignal } from '@/data/lmi';
import { useBursaries } from '@/hooks/useBursaries';
import { useInstitutions } from '@/hooks/useInstitutions';
import { trackUiEvent } from '@/lib/uiAnalytics';
import { filterDisplayableCareers } from '@/lib/dataQuality';
import { searchBursaries, searchCareers, searchInstitutions, searchPastPapers } from '@/lib/intelligentSearch';
import { buildHighlightTerms, getMatchLabel, highlightText } from '@/lib/searchPresentation';

interface SearchResultsProps {
  query: string;
  onNavigate: (view: string) => void;
  onClear: () => void;
  onSearch?: (query: string) => void;
  onViewBursaryDetail?: (bursaryId: string) => void;
  searchHistory?: string[];
  hasUpcomingDeadlines?: boolean;
  isLoggedIn?: boolean;
}

const getExperimentVariant = (seed: string): 'A' | 'B' => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
};

const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  onNavigate,
  onClear,
  onSearch,
  onViewBursaryDetail,
  searchHistory = [],
  hasUpcomingDeadlines = false,
  isLoggedIn = false,
}) => {
  const { bursaries } = useBursaries();
  const { institutions } = useInstitutions();
  const verifiedCareers = useMemo(() => filterDisplayableCareers(careers), []);
  const q = query.toLowerCase();
  const variant = useMemo(() => getExperimentVariant(`${query}:${searchHistory.join('|')}:${hasUpcomingDeadlines}:${isLoggedIn}`), [hasUpcomingDeadlines, isLoggedIn, query, searchHistory]);
  const isUrgentQuery = /deadline|closing|urgent|due|application|submit/i.test(query);

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

  const rankedBursaries = useMemo(() => searchBursaries(bursaries, query, { limit: 7, urgency: isUrgentQuery || hasUpcomingDeadlines }), [bursaries, hasUpcomingDeadlines, isUrgentQuery, query]);
  const rankedInstitutions = useMemo(() => searchInstitutions(institutions, query, { limit: 6 }), [institutions, query]);
  const rankedCareers = useMemo(() => searchCareers(verifiedCareers, query, { limit: 6 }), [query, verifiedCareers]);
  const rankedPapers = useMemo(() => searchPastPapers(pastPapers, query, { limit: 5 }), [query]);

  const bursaryResultById = useMemo(() => new Map(rankedBursaries.map((result) => [result.item.id, result])), [rankedBursaries]);
  const institutionResultById = useMemo(() => new Map(rankedInstitutions.map((result) => [result.item.id, result])), [rankedInstitutions]);
  const careerResultById = useMemo(() => new Map(rankedCareers.map((result) => [result.item.id, result])), [rankedCareers]);
  const paperResultById = useMemo(() => new Map(rankedPapers.map((result) => [result.item.id, result])), [rankedPapers]);

  const topBursaryScore = rankedBursaries[0]?.score ?? 0;
  const topInstitutionScore = rankedInstitutions[0]?.score ?? 0;
  const topCareerScore = rankedCareers[0]?.score ?? 0;
  const topPaperScore = rankedPapers[0]?.score ?? 0;

  const matchedBursaries = rankedBursaries.map((result) => result.item);
  const matchedInstitutions = rankedInstitutions.map((result) => result.item);
  const verifiedMatchedCareers = rankedCareers.map((result) => result.item);
  const matchedPapers = rankedPapers.map((result) => result.item);

  const adaptiveSuggestions = useMemo(() => {
    const fromHistory = searchHistory.slice(0, 4);
    const fromRealData = [
      ...rankedBursaries.slice(0, 2).map((result) => result.item.name),
      ...rankedInstitutions.slice(0, 2).map((result) => result.item.name),
      ...rankedCareers.slice(0, 2).map((result) => result.item.name),
    ];

    return [...fromHistory, ...fromRealData].filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 6);
  }, [rankedBursaries, rankedCareers, rankedInstitutions, searchHistory]);

  const sortByUrgency = <T extends { deadline?: string }>(items: T[]) => {
    if (!isUrgentQuery && !hasUpcomingDeadlines) return items;
    return [...items].sort((a, b) => {
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  };

  const rankedBursariesForDisplay = sortByUrgency(matchedBursaries);
  const urgencyRankingActive = isUrgentQuery || hasUpcomingDeadlines;

  useEffect(() => {
    if (adaptiveSuggestions.length === 0) return;
    trackUiEvent('search_suggestion_impression', {
      value: adaptiveSuggestions.length,
      meta: {
        query,
        variant,
        urgency: urgencyRankingActive,
      },
    });
  }, [adaptiveSuggestions.length, query, urgencyRankingActive, variant]);

  useEffect(() => {
    if (!urgencyRankingActive || rankedBursaries.length === 0) return;
    trackUiEvent('search_urgency_results_impression', {
      value: rankedBursaries.length,
      meta: {
        query,
        variant,
      },
    });
  }, [query, rankedBursaries.length, urgencyRankingActive, variant]);

  const totalResults = matchedBursaries.length + matchedInstitutions.length + verifiedMatchedCareers.length + matchedPapers.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Search className="w-7 h-7 text-blue-600" />
            Search Results
          </h1>
          <p className="mt-1 text-gray-600">
            {totalResults} result{totalResults !== 1 ? 's' : ''} for "<span className="font-medium text-gray-900">{query}</span>"
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${variant === 'B' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}>
              <Sparkles className="w-3.5 h-3.5" /> Variant {variant}
            </span>
            {(isUrgentQuery || hasUpcomingDeadlines) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5" /> Urgency-focused ranking
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          <X className="w-4 h-4" /> Clear
        </button>
      </div>

      {totalResults === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <Search className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900">No results found</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">Try different keywords or browse our categories directly</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2 px-4">
            {adaptiveSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  trackUiEvent('search_suggestion_click', {
                    meta: {
                      query,
                      variant,
                      source: 'empty-state',
                    },
                  });
                  onSearch?.(suggestion);
                }}
                className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 text-xs font-medium"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-xs font-semibold text-gray-700 mb-2">Suggested next searches</p>
        <div className="flex flex-wrap gap-2">
          {adaptiveSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => {
                trackUiEvent('search_suggestion_click', {
                  meta: {
                    query,
                    variant,
                    source: 'suggested-next',
                  },
                });
                onSearch?.(suggestion);
              }}
              className="px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-medium"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* Careers */}
      {verifiedMatchedCareers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Careers ({verifiedMatchedCareers.length})
            </h2>
            <button onClick={() => onNavigate('careers')} className="text-blue-700 text-sm font-medium hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {verifiedMatchedCareers.map(career => {
              const result = careerResultById.get(career.id);
              const lmi = getLMISignal(career);
              const terms = buildHighlightTerms(query, result?.matchedTokens);

              return (
                <div key={career.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('careers')}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">{highlightText(career.name, terms)}</h3>
                    {result ? (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {getMatchLabel(result.score, topCareerScore)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500">{highlightText(career.field, terms)} | {lmi.signal} {lmi.demandScore}/100</p>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{highlightText(career.description, terms)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bursaries */}
      {matchedBursaries.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-green-600" />
              Bursaries ({matchedBursaries.length})
            </h2>
            <button onClick={() => onNavigate('bursaries')} className="text-blue-700 text-sm font-medium hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rankedBursariesForDisplay.map(b => {
              const result = bursaryResultById.get(b.id);
              const terms = buildHighlightTerms(query, result?.matchedTokens);

              return (
              <div
                key={b.id}
                className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all cursor-pointer"
                onClick={() => {
                  if (urgencyRankingActive) {
                    trackUiEvent('search_urgency_result_click', {
                      meta: {
                        query,
                        variant,
                        bursaryId: b.id,
                      },
                    });
                  }
                  onNavigate('bursaries');
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{highlightText(b.name, terms)}</h3>
                  {result ? (
                    <span className="inline-flex shrink-0 items-center rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                      {getMatchLabel(result.score, topBursaryScore)}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-gray-500">{highlightText(b.provider, terms)} | {highlightText(b.field, terms)}</p>
                <p className="text-sm text-green-700 font-medium mt-1">{highlightText(b.amount, terms)}</p>
                <div className="mt-2 text-[11px] text-gray-500">
                  <p>Source: <span className="font-medium text-gray-700">{getSourceLabel(b.verificationSource)}</span></p>
                  <p>{getFreshnessLabel(b.lastVerified)}</p>
                </div>
                {onViewBursaryDetail ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewBursaryDetail(b.id);
                    }}
                    className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50"
                  >
                    View bursary details
                  </button>
                ) : null}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Institutions */}
      {matchedInstitutions.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              Institutions ({matchedInstitutions.length})
            </h2>
            <button onClick={() => onNavigate('institutions')} className="text-blue-700 text-sm font-medium hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchedInstitutions.map(inst => {
              const result = institutionResultById.get(inst.id);
              const terms = buildHighlightTerms(query, result?.matchedTokens);

              return (
                <div key={inst.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('institutions')}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">{highlightText(inst.name, terms)}</h3>
                    {result ? (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                        {getMatchLabel(result.score, topInstitutionScore)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500">{highlightText(inst.type, terms)} | {highlightText(`${inst.location}, ${inst.province}`, terms)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Papers */}
      {matchedPapers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-500" />
              Past Papers ({matchedPapers.length})
            </h2>
            <button onClick={() => onNavigate('papers')} className="text-blue-700 text-sm font-medium hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matchedPapers.map(p => {
              const result = paperResultById.get(p.id);
              const terms = buildHighlightTerms(query, result?.matchedTokens);

              return (
                <div key={p.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all cursor-pointer" onClick={() => onNavigate('papers')}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">{highlightText(p.subject, terms)}</h3>
                    {result ? (
                      <span className="inline-flex shrink-0 items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                        {getMatchLabel(result.score, topPaperScore)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500">{highlightText(`${p.grade} | ${p.year} | ${p.paperNumber} | ${p.type}`, terms)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
