import React, { useState } from 'react';
import { Search, Building2, MapPin, ExternalLink, Heart, Star, GraduationCap, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { IMAGES } from '@/data/staticData';
import type { UserProfile } from '@/hooks/useAuth';
import { useInstitutions } from '@/hooks/useInstitutions';

interface InstitutionFinderProps {
  profile: UserProfile | null;
  onToggleSave?: (institutionId: string) => void;
}

const InstitutionFinder: React.FC<InstitutionFinderProps> = ({ profile, onToggleSave }) => {
  const { institutions, provinces, loading, error } = useInstitutions();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [expandedInst, setExpandedInst] = useState<string | null>(null);

  const filteredInstitutions = institutions.filter(inst => {
    const matchesSearch = searchQuery === '' ||
      inst.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inst.courses.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === 'all' || inst.type === typeFilter;
    const matchesProvince = provinceFilter === 'all' || inst.province === provinceFilter;
    return matchesSearch && matchesType && matchesProvince;
  });

  const isSaved = (id: string) => profile?.saved_institutions?.includes(id) || false;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'University': return 'bg-blue-100 text-blue-700';
      case 'TVET': return 'bg-green-100 text-green-700';
      case 'Private College': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-12 text-gray-600">Loading institutions...</div>;
  }

  if (error) {
    return <div className="max-w-7xl mx-auto px-4 py-12 text-red-600">Could not load institutions.</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          Institution Finder
        </h1>
        <p className="mt-2 text-gray-600">Explore universities, TVET colleges, and private institutions across South Africa</p>
      </div>

      {/* Type Quick Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {['all', 'University', 'TVET', 'Private College'].map((type) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              typeFilter === type
                ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {type === 'all' ? 'All Types' : type === 'TVET' ? 'TVET Colleges' : type === 'Private College' ? 'Private Colleges' : 'Universities'}
            <span className="ml-2 text-xs opacity-75">
              ({type === 'all' ? institutions.length : institutions.filter(i => i.type === type).length})
            </span>
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, location, or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            aria-label="Filter by province"
            className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white"
          >
            <option value="all">All Provinces</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <p className="mt-3 text-sm text-gray-500">{filteredInstitutions.length} institution{filteredInstitutions.length !== 1 ? 's' : ''} found</p>
      </div>

      {/* Institution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInstitutions.map((inst, index) => (
          <div key={inst.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all group">
            {/* Image */}
            <div className="h-48 overflow-hidden relative">
              <img
                src={IMAGES.campuses[index % IMAGES.campuses.length]}
                alt={inst.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3">
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getTypeColor(inst.type)}`}>
                  {inst.type}
                </span>
              </div>
              {onToggleSave && (
                <button
                  onClick={() => onToggleSave(inst.id)}
                  title={isSaved(inst.id) ? 'Remove from saved' : 'Save institution'}
                  aria-label={isSaved(inst.id) ? 'Remove from saved' : 'Save institution'}
                  className={`absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-sm transition-colors ${
                    isSaved(inst.id) ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isSaved(inst.id) ? 'fill-current' : ''}`} />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{inst.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                <MapPin className="w-4 h-4" />
                <span>{inst.location}, {inst.province}</span>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= Math.round(inst.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`}
                  />
                ))}
                <span className="text-sm text-gray-600 ml-1">{inst.rating}</span>
              </div>

              <p className="text-sm text-gray-600 line-clamp-2 mb-4">{inst.description}</p>

              {/* Courses */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {inst.courses.slice(0, 4).map(c => (
                  <span key={c} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md">{c}</span>
                ))}
                {inst.courses.length > 4 && (
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-md">+{inst.courses.length - 4} more</span>
                )}
              </div>

              <button
                onClick={() => setExpandedInst(expandedInst === inst.id ? null : inst.id)}
                className="w-full py-2.5 bg-purple-50 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100 transition-colors flex items-center justify-center gap-2"
              >
                {expandedInst === inst.id ? 'Show Less' : 'View Details'}
                {expandedInst === inst.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {expandedInst === inst.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">All Courses Offered</p>
                    <div className="flex flex-wrap gap-1.5">
                      {inst.courses.map(c => (
                        <span key={c} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md">{c}</span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={inst.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-purple-700 text-white text-sm font-medium rounded-lg hover:bg-purple-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Visit Website
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredInstitutions.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No verified institutions found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your search or filters, or refresh after new verified records are seeded</p>
        </div>
      )}
    </div>
  );
};

export default InstitutionFinder;
