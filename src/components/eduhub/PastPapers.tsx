import React, { useState } from 'react';
import { Search, FileText, Download, Filter, BookOpen, File } from 'lucide-react';
import { pastPapers, PastPaper } from '@/data/staticData';
import { isDownloadablePastPaper } from '@/lib/dataQuality';


const PastPapers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [boardFilter, setBoardFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const subjects = [...new Set(pastPapers.map(p => p.subject))];
  const grades = [...new Set(pastPapers.map(p => p.grade))];
  const years = [...new Set(pastPapers.map(p => p.year))].sort((a, b) => b.localeCompare(a));

  const filteredPapers = pastPapers.filter(paper => {
    const matchesSearch = searchQuery === '' ||
      paper.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = subjectFilter === 'all' || paper.subject === subjectFilter;
    const matchesGrade = gradeFilter === 'all' || paper.grade === gradeFilter;
    const matchesYear = yearFilter === 'all' || paper.year === yearFilter;
    const matchesBoard = boardFilter === 'all' || paper.examBoard === boardFilter;
    const matchesType = typeFilter === 'all' || paper.type === typeFilter;
    return matchesSearch && matchesSubject && matchesGrade && matchesYear && matchesBoard && matchesType;
  });

  // Group by subject
  const groupedPapers: Record<string, PastPaper[]> = {};
  filteredPapers.forEach(paper => {
    if (!groupedPapers[paper.subject]) groupedPapers[paper.subject] = [];
    groupedPapers[paper.subject].push(paper);
  });

  const getSubjectColor = (subject: string) => {
    const colors: Record<string, string> = {
      'Mathematics': 'bg-blue-100 text-blue-700 border-blue-200',
      'Physical Sciences': 'bg-purple-100 text-purple-700 border-purple-200',
      'Life Sciences': 'bg-green-100 text-green-700 border-green-200',
      'Accounting': 'bg-orange-100 text-orange-700 border-orange-200',
      'English Home Language': 'bg-red-100 text-red-700 border-red-200',
      'Business Studies': 'bg-teal-100 text-teal-700 border-teal-200',
      'Economics': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Geography': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'History': 'bg-amber-100 text-amber-700 border-amber-200',
      'Information Technology': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    };
    return colors[subject] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          Past Papers Library
        </h1>
        <p className="mt-2 text-gray-600">Access NSC and IEB past exam papers and memos to prepare for your exams</p>
      </div>

      {/* Study Tip */}
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-5 mb-8 border border-orange-200">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-orange-900">Study Tip</h3>
            <p className="text-sm text-orange-800 mt-1">
              Practice with at least 5 years of past papers per subject. Time yourself under exam conditions for the best preparation!
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
          <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} title="Filter by subject" className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white">
            <option value="all">All Subjects</option>
            {subjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} title="Filter by grade" className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white">
            <option value="all">All Grades</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} title="Filter by year" className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white">
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)} title="Filter by exam board" className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none bg-white">
            <option value="all">All Boards</option>
            <option value="DBE">DBE (National)</option>
            <option value="IEB">IEB</option>
          </select>
        </div>

        {/* Type Quick Filter */}
        <div className="flex gap-3 mt-4">
          {['all', 'Question Paper', 'Memo'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                typeFilter === t
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
              }`}
            >
              {t === 'all' ? 'All Types' : t}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm text-gray-500">{filteredPapers.length} paper{filteredPapers.length !== 1 ? 's' : ''} found</p>
      </div>

      {/* Papers grouped by subject */}
      {Object.entries(groupedPapers).map(([subject, papers]) => (
        <div key={subject} className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${getSubjectColor(subject)}`}>
              {subject}
            </span>
            <span className="text-sm font-normal text-gray-500">({papers.length} papers)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    paper.type === 'Memo' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    <File className={`w-5 h-5 ${paper.type === 'Memo' ? 'text-green-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">
                      {paper.subject}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {paper.grade} | {paper.year} | {paper.paperNumber}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                        paper.type === 'Memo' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {paper.type}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 bg-gray-50 text-gray-600 rounded">
                        {paper.examBoard}
                      </span>
                    </div>
                  </div>
                </div>
                {isDownloadablePastPaper(paper) ? (
                  <a
                    href={paper.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full mt-3 py-2 bg-orange-50 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-100 transition-colors flex items-center justify-center gap-1.5 group-hover:bg-orange-500 group-hover:text-white"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </a>
                ) : (
                  <div className="w-full mt-3 py-2 bg-gray-50 text-gray-500 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    Download unavailable until verified
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {filteredPapers.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-200">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No papers found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};

export default PastPapers;
