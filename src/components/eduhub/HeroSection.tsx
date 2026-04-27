import React, { useEffect, useMemo, useState } from 'react';
import { Search, Compass, Award, Building2, FileText, BookOpen, TrendingUp, ArrowRight, Sunrise, MoonStar, Sparkles } from 'lucide-react';
import { IMAGES } from '@/data/staticData';
import { trackUiEvent } from '@/lib/uiAnalytics';

interface HeroSectionProps {
  onNavigate: (view: string) => void;
  onSearch: (query: string) => void;
  isLoggedIn: boolean;
  searchHistory?: string[];
}

const getExperimentVariant = (seed: string): 'A' | 'B' => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
};

const HeroSection: React.FC<HeroSectionProps> = ({ onNavigate, onSearch, isLoggedIn, searchHistory = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const hour = new Date().getHours();
  const daySegment = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const heroMode = isLoggedIn ? 'returning' : searchHistory.length > 0 ? 'curious' : 'new';
  const experimentVariant = useMemo(() => getExperimentVariant(`${daySegment}:${isLoggedIn}:${searchHistory.join('|')}`), [daySegment, isLoggedIn, searchHistory]);

  const heroCopy = {
    new: {
      title: 'Discover Your Future,',
      accent: 'Find Your Path',
      subtitle: "South Africa's centralized hub for bursaries, career guidance, institutions, and study resources. Your journey to educational success starts here.",
      modeLabel: 'Starter Mode',
    },
    curious: {
      title: 'Keep Exploring,',
      accent: 'You Are Close',
      subtitle: 'Your recent searches already show momentum. Narrow in on the right bursary, institution, or career fit today.',
      modeLabel: 'Explorer Mode',
    },
    returning: {
      title: 'Welcome Back,',
      accent: 'Build Momentum',
      subtitle: 'Jump back into opportunities with focused search and faster action routing tailored to your journey.',
      modeLabel: 'Momentum Mode',
    },
  } as const;

  const contextualTags = useMemo(() => {
    const base = daySegment === 'morning'
      ? ['NSFAS', 'Matric revision', 'Engineering']
      : daySegment === 'afternoon'
        ? ['Nursing', 'IT Careers', 'TVET Colleges']
        : ['Scholarships 2026', 'Business Studies', 'Application tracker'];

    const historyBoost = searchHistory.slice(0, 3);
    return [...historyBoost, ...base].filter((item, index, arr) => arr.indexOf(item) === index).slice(0, 6);
  }, [daySegment, searchHistory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const normalized = searchQuery.trim();
      trackUiEvent('hero_search_submit', {
        meta: {
          mode: heroMode,
          variant: experimentVariant,
          source: 'form',
        },
      });
      onSearch(normalized);
    }
  };

  useEffect(() => {
    trackUiEvent('hero_impression', {
      meta: {
        mode: heroMode,
        variant: experimentVariant,
        daySegment,
        loggedIn: isLoggedIn,
      },
    });
  }, [daySegment, experimentVariant, heroMode, isLoggedIn]);

  const quickLinks = [
    { id: 'careers', label: 'Career Explorer', icon: Compass, color: 'from-blue-600 to-blue-700', description: 'Find your ideal career path' },
    { id: 'bursaries', label: 'Bursaries', icon: Award, color: 'from-green-600 to-green-700', description: 'Discover funding opportunities' },
    { id: 'institutions', label: 'Institutions', icon: Building2, color: 'from-purple-600 to-purple-700', description: 'Explore colleges & universities' },
    { id: 'papers', label: 'Past Papers', icon: FileText, color: 'from-orange-500 to-orange-600', description: 'Practice with past exams' },
    { id: 'resources', label: 'Transition Guides', icon: BookOpen, color: 'from-teal-600 to-teal-700', description: 'Navigate your education journey' },
  ].sort((a, b) => {
    if (heroMode === 'new') {
      if (a.id === 'bursaries') return -1;
      if (b.id === 'bursaries') return 1;
    }
    if (heroMode === 'returning') {
      if (a.id === 'careers') return -1;
      if (b.id === 'careers') return 1;
    }
    return 0;
  });

  const stats = [
    { value: '18+', label: 'Bursaries Listed', icon: Award },
    { value: '15+', label: 'Institutions', icon: Building2 },
    { value: '12', label: 'Career Paths', icon: TrendingUp },
    { value: '27+', label: 'Past Papers', icon: FileText },
  ];

  return (
    <div>
      {/* Hero Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={IMAGES.hero} alt="South African students" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 via-blue-800/80 to-green-800/70" />
        </div>
        
        <div className="relative section-shell py-16 sm:py-24 lg:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-sm px-3 py-1.5 mb-5 hero-reveal hero-reveal-1">
              {daySegment === 'evening' ? <MoonStar className="w-4 h-4 text-yellow-200" /> : <Sunrise className="w-4 h-4 text-yellow-200" />}
              <span className="text-xs font-medium text-white">{heroCopy[heroMode].modeLabel}</span>
              <span className="text-[11px] text-blue-100">Variant {experimentVariant}</span>
            </div>

            {/* SA flag accent line */}
            <div className="flex gap-1 mb-6 hero-reveal hero-reveal-1">
              <div className="h-1 w-8 bg-green-500 rounded-full" />
              <div className="h-1 w-8 bg-yellow-400 rounded-full" />
              <div className="h-1 w-8 bg-red-500 rounded-full" />
              <div className="h-1 w-8 bg-blue-400 rounded-full" />
              <div className="h-1 w-8 bg-white rounded-full" />
            </div>

            <h1 className="display-heading text-3xl sm:text-4xl lg:text-6xl text-white leading-tight hero-reveal hero-reveal-2">
              {heroCopy[heroMode].title}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-yellow-300">
                {heroCopy[heroMode].accent}
              </span>
            </h1>
            <p className="mt-4 sm:mt-6 text-lg sm:text-xl text-blue-100 max-w-2xl hero-reveal hero-reveal-3 leading-relaxed">
              {heroCopy[heroMode].subtitle}
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mt-8 flex flex-col sm:flex-row gap-3 hero-reveal hero-reveal-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={heroMode === 'returning' ? 'Try: bursary deadlines, CV tips, nursing programmes...' : 'Search bursaries, careers, institutions, or courses...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 placeholder-gray-500 bg-white shadow-lg focus:ring-4 focus:ring-blue-300 outline-none text-base"
                />
              </div>
              <button
                type="submit"
                className={`px-8 py-4 text-white font-semibold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                  experimentVariant === 'B'
                    ? 'bg-gradient-to-r from-green-500 to-lime-500 hover:from-green-600 hover:to-lime-600'
                    : 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600'
                }`}
              >
                <Search className="w-5 h-5" />
                {heroMode === 'returning' ? 'Resume Search' : 'Search'}
              </button>
            </form>

            {/* Quick tags */}
            <div className="mt-4 flex flex-wrap gap-2 hero-reveal hero-reveal-5">
              {contextualTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSearchQuery(tag);
                    trackUiEvent('hero_search_submit', {
                      meta: {
                        mode: heroMode,
                        variant: experimentVariant,
                        source: 'context-tag',
                      },
                    });
                    onSearch(tag);
                  }}
                  className="px-3 py-1.5 bg-white/15 backdrop-blur-sm text-white text-sm rounded-full hover:bg-white/25 transition-colors border border-white/20"
                >
                  {tag}
                </button>
              ))}
            </div>

            {searchHistory.length > 0 && (
              <div className="mt-4 hero-reveal hero-reveal-5">
                <p className="text-xs text-blue-100 mb-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Continue from recent interests
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.slice(0, 4).map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        trackUiEvent('hero_search_submit', {
                          meta: {
                            mode: heroMode,
                            variant: experimentVariant,
                            source: 'history-tag',
                          },
                        });
                        onSearch(item);
                      }}
                      className="px-3 py-1.5 bg-black/20 backdrop-blur-sm text-white text-xs rounded-full hover:bg-black/30 transition-colors border border-white/20"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-white border-b border-gray-200 shadow-sm">
        <div className="section-shell py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Links Grid */}
      <section className="section-shell py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="display-heading text-2xl sm:text-3xl text-gray-900">Explore Your Options</h2>
          <p className="mt-2 muted-copy max-w-2xl mx-auto">
            Everything you need to plan your educational journey, all in one place
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className="group surface-card p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300 text-left hover:-translate-y-1"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${link.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">{link.label}</h3>
                <p className="mt-1 text-sm text-gray-500">{link.description}</p>
                <div className="mt-3 flex items-center gap-1 text-blue-700 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Featured Students / Testimonials */}
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-12 sm:py-16">
        <div className="section-shell">
          <div className="text-center mb-10">
            <h2 className="display-heading text-2xl sm:text-3xl text-gray-900">Success Stories</h2>
            <p className="mt-2 muted-copy">Learners who found their path through EduHub SA</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Thandi M.', school: 'Wits University', field: 'Software Engineering', quote: 'EduHub helped me find the perfect bursary and career path. I\'m now studying what I love!', img: IMAGES.students[0] },
              { name: 'Sipho K.', school: 'Ekurhuleni TVET', field: 'Electrical Engineering', quote: 'I didn\'t know TVET was an option until I used EduHub. Now I\'m gaining practical skills!', img: IMAGES.students[1] },
              { name: 'Naledi P.', school: 'UCT Medical School', field: 'Medicine', quote: 'The career recommender showed me I had the right subjects for medicine. Dreams do come true!', img: IMAGES.students[2] },
              { name: 'Andile D.', school: 'Varsity College', field: 'Digital Marketing', quote: 'Past papers on EduHub helped me ace my matric exams and get into my dream course.', img: IMAGES.students[3] },
            ].map((story, i) => (
              <div key={i} className="surface-card p-6 hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <img src={story.img} alt={story.name} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <p className="font-semibold text-gray-900">{story.name}</p>
                    <p className="text-xs text-gray-500">{story.school}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 italic">"{story.quote}"</p>
                <div className="mt-3">
                  <span className="inline-block px-2.5 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                    {story.field}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HeroSection;
