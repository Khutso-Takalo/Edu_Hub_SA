import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Clock, Search, Tag, ArrowRight } from 'lucide-react';
import { resources, Resource } from '@/data/staticData';

const ResourceGuides: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  const categories = [...new Set(resources.map(r => r.category))];

  const filteredResources = resources.filter(r => {
    const matchesSearch = searchQuery === '' ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Transition Guide': return 'bg-blue-100 text-blue-700';
      case 'Study Tips': return 'bg-green-100 text-green-700';
      case 'Career Advice': return 'bg-purple-100 text-purple-700';
      case 'Financial Aid': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Transition Guide': return '🎓';
      case 'Study Tips': return '📚';
      case 'Career Advice': return '💼';
      case 'Financial Aid': return '💰';
      default: return '📖';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          Guides & Resources
        </h1>
        <p className="mt-2 text-gray-600">Essential guides to help you navigate your educational journey in South Africa</p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
            categoryFilter === 'all'
              ? 'bg-teal-600 text-white border-teal-600'
              : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:bg-teal-50'
          }`}
        >
          All Guides ({resources.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all border ${
              categoryFilter === cat
                ? 'bg-teal-600 text-white border-teal-600'
                : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:bg-teal-50'
            }`}
          >
            {cat} ({resources.filter(r => r.category === cat).length})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search guides and resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none bg-white"
        />
      </div>

      {/* Resource Cards */}
      <div className="space-y-4">
        {filteredResources.map((resource) => (
          <div
            key={resource.id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all"
          >
            <button
              onClick={() => setExpandedResource(expandedResource === resource.id ? null : resource.id)}
              className="w-full p-5 sm:p-6 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getCategoryColor(resource.category)}`}>
                      {resource.category}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {resource.readTime} read
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">{resource.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{resource.description}</p>
                </div>
                <div className="flex-shrink-0 mt-1">
                  {expandedResource === resource.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>
            </button>

            {expandedResource === resource.id && (
              <div className="border-t border-gray-100 p-5 sm:p-6 bg-gray-50">
                <div className="prose prose-sm max-w-none">
                  {resource.content.split('\n\n').map((paragraph, i) => {
                    if (paragraph.startsWith('**') && paragraph.endsWith('**')) {
                      return <h4 key={i} className="text-base font-bold text-gray-900 mt-4 mb-2">{paragraph.replace(/\*\*/g, '')}</h4>;
                    }
                    if (paragraph.includes('**')) {
                      const parts = paragraph.split('**');
                      return (
                        <p key={i} className="text-sm text-gray-700 leading-relaxed mb-3">
                          {parts.map((part, j) => (
                            j % 2 === 1 ? <strong key={j} className="text-gray-900">{part}</strong> : <span key={j}>{part}</span>
                          ))}
                        </p>
                      );
                    }
                    if (paragraph.startsWith('- ')) {
                      return (
                        <ul key={i} className="space-y-1 mb-3 ml-4">
                          {paragraph.split('\n').map((line, j) => (
                            <li key={j} className="text-sm text-gray-700 flex items-start gap-2">
                              <div className="w-1.5 h-1.5 bg-teal-500 rounded-full mt-2 flex-shrink-0" />
                              {line.replace(/^- /, '')}
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return <p key={i} className="text-sm text-gray-700 leading-relaxed mb-3">{paragraph}</p>;
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredResources.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No guides found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your search or category filter</p>
        </div>
      )}
    </div>
  );
};

export default ResourceGuides;
