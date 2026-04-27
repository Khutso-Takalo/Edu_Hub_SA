import React, { useState } from 'react';
import { Search, TrendingUp, Briefcase, GraduationCap, Building2, DollarSign, ChevronDown, ChevronUp, Heart, Filter, ArrowRight, Zap, BookOpen, Star } from 'lucide-react';
import { careers, Career, getCareerRecommendations, CAREER_INTEREST_OPTIONS } from '@/data/staticData';
import { getLMISignal, getPathwayRecommendations } from '@/data/lmi';
import type { UserProfile } from '@/hooks/useAuth';
import { filterDisplayableCareers } from '@/lib/dataQuality';

interface CareerExplorerProps {
  profile: UserProfile | null;
  onToggleSave?: (careerId: string) => void;
}

const CareerExplorer: React.FC<CareerExplorerProps> = ({ profile, onToggleSave }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [demandFilter, setDemandFilter] = useState<string>('all');
  const [fieldFilter, setFieldFilter] = useState<string>('all');
  const [expandedCareer, setExpandedCareer] = useState<string | null>(null);
  const [showRecommender, setShowRecommender] = useState(false);
  const verifiedCareers = filterDisplayableCareers(careers);

  // Get recommendations if profile exists
  const recommendations = profile?.subjects?.length && profile?.career_interests?.length
    ? getCareerRecommendations(profile.subjects, profile.career_interests, profile.aps_score)
    : [];

  const fields = [...new Set(verifiedCareers.map(c => c.field))];

  const filteredCareers = verifiedCareers.filter(career => {
    const matchesSearch = searchQuery === '' || 
      career.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      career.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      career.field.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDemand = demandFilter === 'all' || career.demandLevel === demandFilter;
    const matchesField = fieldFilter === 'all' || career.field === fieldFilter;
    return matchesSearch && matchesDemand && matchesField;
  });

  const topPathways = getPathwayRecommendations(verifiedCareers, profile || undefined, 3);

  const isSaved = (id: string) => profile?.saved_careers?.includes(id) || false;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          Career Explorer
        </h1>
        <p className="mt-2 text-gray-600">Discover in-demand careers in South Africa and find the right path for you</p>
      </div>

      {/* Personalized Recommendations */}
      {recommendations.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Your Personalized Recommendations
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.slice(0, 3).map((career, i) => (
              <div key={career.id} className="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl p-5 border border-blue-200 hover:shadow-lg transition-all">
                {(() => {
                  const lmi = getLMISignal(career);
                  return (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-white bg-blue-600 px-2.5 py-1 rounded-full">#{i + 1} Match</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    career.demandLevel === 'High' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {lmi.signal} Demand {lmi.demandScore}/100
                  </span>
                </div>
                  );
                })()}
                <h3 className="text-lg font-bold text-gray-900">{career.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{career.field}</p>
                <p className="text-sm text-gray-600 line-clamp-2">{career.description}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm font-semibold text-green-700">{career.salary}</span>
                  <button
                    onClick={() => setExpandedCareer(expandedCareer === career.id ? null : career.id)}
                    className="text-blue-700 text-sm font-medium hover:underline flex items-center gap-1"
                    title="View career details"
                    aria-label="View career details"
                  >
                    Details <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topPathways.length > 0 && (
        <div className="mb-10 bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 border border-sky-200 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-sky-700" />
              Pathway Finder
            </h2>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-white text-sky-700 border border-sky-200">
              Local LMI model
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {topPathways.map((pathway, index) => (
              <div key={pathway.career.id} className="bg-white rounded-xl border border-sky-100 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-white bg-sky-700 px-2 py-0.5 rounded-full">#{index + 1}</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    {pathway.demand.signal} {pathway.demand.demandScore}/100
                  </span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{pathway.career.name}</h3>
                <p className="text-xs text-gray-500 mt-1">Readiness: {pathway.readinessScore}%</p>
                <p className="text-xs text-gray-500">Route: {pathway.qualificationPath}</p>
                {pathway.missingSubjects.length > 0 ? (
                  <p className="text-xs text-amber-700 mt-2">
                    Missing subjects: {pathway.missingSubjects.slice(0, 2).join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700 mt-2">Subject alignment looks strong.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search careers by name, field, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={demandFilter}
            onChange={(e) => setDemandFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            title="Filter careers by demand level"
            aria-label="Filter careers by demand level"
          >
            <option value="all">All Demand Levels</option>
            <option value="High">High Demand</option>
            <option value="Medium">Medium Demand</option>
          </select>
          <select
            value={fieldFilter}
            onChange={(e) => setFieldFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
            title="Filter careers by field"
            aria-label="Filter careers by field"
          >
            <option value="all">All Fields</option>
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <p className="mt-3 text-sm text-gray-500">{filteredCareers.length} career{filteredCareers.length !== 1 ? 's' : ''} found</p>
      </div>

      {/* Career Cards */}
      <div className="space-y-4">
        {filteredCareers.map((career) => (
          <div key={career.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
            <div
              className="p-5 sm:p-6 cursor-pointer"
              onClick={() => setExpandedCareer(expandedCareer === career.id ? null : career.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                    {(() => {
                      const lmi = getLMISignal(career);
                      return (
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      career.demandLevel === 'High' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      <TrendingUp className="w-3 h-3 inline mr-1" />
                      {lmi.signal} Demand
                    </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
                        Score {lmi.demandScore}/100
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        +{lmi.projectedGrowthPct}% growth
                      </span>
                    <span className="text-xs font-medium px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">{career.field}</span>
                    {career.minAPS > 0 && (
                      <span className="text-xs font-medium px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full">
                        Min APS: {career.minAPS}
                      </span>
                    )}
                  </div>
                      );
                    })()}
                  <h3 className="text-xl font-bold text-gray-900">{career.name}</h3>
                  <p className="text-sm text-gray-600 mt-2">{career.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-sm font-semibold text-green-700 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {career.salary}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {onToggleSave && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleSave(career.id); }}
                      className={`p-2 rounded-lg transition-colors ${
                        isSaved(career.id) ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title={isSaved(career.id) ? 'Remove from saved careers' : 'Save career'}
                      aria-label={isSaved(career.id) ? 'Remove from saved careers' : 'Save career'}
                    >
                      <Heart className={`w-5 h-5 ${isSaved(career.id) ? 'fill-current' : ''}`} />
                    </button>
                  )}
                  {expandedCareer === career.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedCareer === career.id && (
              <div className="border-t border-gray-100 p-5 sm:p-6 bg-gray-50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    {(() => {
                      const lmi = getLMISignal(career);
                      return (
                        <>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-sky-600" />
                            Labour Market Signals
                          </h4>
                          <div className="space-y-2 text-sm text-gray-700">
                            <p>Demand score: <span className="font-semibold">{lmi.demandScore}/100</span></p>
                            <p>Projected growth: <span className="font-semibold">+{lmi.projectedGrowthPct}%</span></p>
                            <p>Estimated openings: <span className="font-semibold">{lmi.openingsEstimate.toLocaleString('en-ZA')}</span></p>
                            <p className="text-xs text-gray-500">Source: {lmi.source} • Updated {lmi.lastUpdated}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Why this career */}
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                      <Star className="w-4 h-4 text-yellow-500" />
                      Why This Career in SA?
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{career.longevityReason}</p>
                  </div>

                  {/* Required Subjects */}
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      Required Subjects
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {career.requiredSubjects.map(s => {
                        const userHas = profile?.subjects?.some(us => us.name === s);
                        return (
                          <span key={s} className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                            userHas ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {userHas && <span className="mr-1">&#10003;</span>}
                            {s}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Courses */}
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                      <GraduationCap className="w-4 h-4 text-green-600" />
                      Example Courses
                    </h4>
                    <ul className="space-y-1.5">
                      {career.exampleCourses.map(c => (
                        <li key={c} className="text-sm text-gray-600 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Institutions */}
                  <div>
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                      <Building2 className="w-4 h-4 text-purple-600" />
                      Recommended Institutions
                    </h4>
                    <ul className="space-y-1.5">
                      {career.recommendedInstitutions.map(inst => (
                        <li key={inst} className="text-sm text-gray-600 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-purple-500 rounded-full flex-shrink-0" />
                          {inst}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {(() => {
                  const pathway = getPathwayRecommendations([career], profile || undefined, 1)[0];
                  if (!pathway) return null;

                  return (
                    <div className="mt-6 rounded-xl border border-sky-100 bg-sky-50 p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Pathway Steps</h4>
                      <ul className="space-y-1.5">
                        {pathway.steps.map((step) => (
                          <li key={step} className="text-sm text-gray-700 flex items-start gap-2">
                            <span className="mt-1 w-1.5 h-1.5 rounded-full bg-sky-600" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button 
                    className="px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors"
                    title="Explore related bursaries"
                    aria-label="Explore related bursaries"
                  >
                    Explore Related Bursaries
                  </button>
                  <button 
                    className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                    title="View institutions"
                    aria-label="View institutions"
                  >
                    View Institutions
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredCareers.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No verified careers found</h3>
            <p className="text-gray-500 mt-1">Try adjusting your search or filters, or refresh after new verified records are seeded</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CareerExplorer;
