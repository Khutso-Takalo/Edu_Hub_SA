import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Plus, X, Loader2, GraduationCap } from 'lucide-react';
import { SA_SUBJECTS, CAREER_INTEREST_OPTIONS, PROVINCES, GRADE_LEVELS, calculateAPS } from '@/data/staticData';
import type { SignUpPersonaContext, UserProfile } from '@/hooks/useAuth';

interface ProfileSetupProps {
  profile: UserProfile | null;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
  signupPersonaContext?: SignUpPersonaContext | null;
  onSaveSignupPersona?: (context: SignUpPersonaContext) => Promise<void>;
  onComplete: () => void;
}

const PERSONA_OPTIONS: Array<{ value: SignUpPersonaContext['personaType']; label: string }> = [
  { value: 'learner', label: 'Learner' },
  { value: 'parent_guardian', label: 'Parent/Guardian' },
  { value: 'teacher_counselor', label: 'Teacher/Counselor' },
  { value: 'graduate_upskiller', label: 'Graduate/Upskiller' },
];

const APS_PROGRESS_WIDTH_CLASSES = [
  'w-0',
  'w-[5%]',
  'w-[10%]',
  'w-[15%]',
  'w-[20%]',
  'w-[25%]',
  'w-[30%]',
  'w-[35%]',
  'w-[40%]',
  'w-[45%]',
  'w-1/2',
  'w-[55%]',
  'w-[60%]',
  'w-[65%]',
  'w-[70%]',
  'w-[75%]',
  'w-[80%]',
  'w-[85%]',
  'w-[90%]',
  'w-[95%]',
  'w-full',
] as const;

const getApsProgressWidthClass = (apsScore: number) => {
  const percentage = Math.min(100, Math.max(0, (apsScore / 42) * 100));
  const stepIndex = Math.min(
    APS_PROGRESS_WIDTH_CLASSES.length - 1,
    Math.round(percentage / 5)
  );
  return APS_PROGRESS_WIDTH_CLASSES[stepIndex];
};

const ProfileSetup: React.FC<ProfileSetupProps> = ({
  profile,
  onSave,
  signupPersonaContext,
  onSaveSignupPersona,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gradeLevel, setGradeLevel] = useState(profile?.grade_level || '');
  const [province, setProvince] = useState(profile?.province || '');
  const [subjects, setSubjects] = useState<{ name: string; mark: number }[]>(
    profile?.subjects?.length ? profile.subjects : [{ name: '', mark: 0 }]
  );
  const [interests, setInterests] = useState<string[]>(profile?.career_interests || []);
  const [personaType, setPersonaType] = useState<SignUpPersonaContext['personaType']>(
    signupPersonaContext?.personaType || 'learner'
  );
  const [priorityKeywordInput, setPriorityKeywordInput] = useState(
    (signupPersonaContext?.scrapeFocusKeywords || []).join(', ')
  );

  const apsScore = calculateAPS(subjects.filter(s => s.name && s.mark > 0));
  const apsProgressWidthClass = getApsProgressWidthClass(apsScore);

  const addSubject = () => {
    if (subjects.length < 9) {
      setSubjects([...subjects, { name: '', mark: 0 }]);
    }
  };

  const removeSubject = (index: number) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const updateSubject = (index: number, field: 'name' | 'mark', value: string | number) => {
    const updated = [...subjects];
    if (field === 'name') updated[index].name = value as string;
    else updated[index].mark = Math.min(100, Math.max(0, value as number));
    setSubjects(updated);
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave({
        grade_level: gradeLevel,
        province,
        subjects: subjects.filter(s => s.name && s.mark > 0),
        aps_score: apsScore,
        career_interests: interests,
        profile_completed: true,
      });

      if (onSaveSignupPersona) {
        await onSaveSignupPersona({
          personaType,
          educationStage: gradeLevel || undefined,
          province: province || undefined,
          careerInterests: interests,
          scrapeFocusKeywords: priorityKeywordInput
            .split(',')
            .map((keyword) => keyword.trim())
            .filter(Boolean)
            .slice(0, 8),
        });
      }

      onComplete();
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const usedSubjects = subjects.map(s => s.name).filter(Boolean);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-700 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Set Up Your Profile</h1>
          <p className="mt-2 text-gray-600">Help us personalize your experience with career and bursary recommendations</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`flex-1 h-2 rounded-full transition-colors ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8">
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-900">Persona-driven scraping profile</p>
            <p className="text-xs text-blue-700 mt-1">
              Review and edit how EduHub prioritizes opportunities for you.
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-xs text-blue-800">
                Persona
                <select
                  value={personaType}
                  onChange={(event) => setPersonaType(event.target.value as SignUpPersonaContext['personaType'])}
                  className="mt-1 w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs"
                >
                  {PERSONA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-blue-800">
                Priority keywords
                <input
                  value={priorityKeywordInput}
                  onChange={(event) => setPriorityKeywordInput(event.target.value)}
                  placeholder="e.g. medicine, nursing, Gauteng bursary"
                  className="mt-1 w-full rounded border border-blue-200 bg-white px-2 py-1 text-xs"
                />
              </label>
            </div>
          </div>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Basic Information</h2>
                <p className="text-sm text-gray-500">Tell us about your current education level</p>
              </div>

              <div>
                <label htmlFor="grade-level" className="block text-sm font-medium text-gray-700 mb-2">Grade Level / Education Stage</label>
                <select
                  id="grade-level"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select your level...</option>
                  {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="province" className="block text-sm font-medium text-gray-700 mb-2">Province</label>
                <select
                  id="province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">Select your province...</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Subjects & Marks */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Subjects & Marks</h2>
                <p className="text-sm text-gray-500">Add your subjects and latest marks (or expected marks)</p>
              </div>

              <div className="space-y-3">
                {subjects.map((subject, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <select
                      aria-label={`Subject ${index + 1}`}
                      value={subject.name}
                      onChange={(e) => updateSubject(index, 'name', e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                    >
                      <option value="">Select subject...</option>
                      {SA_SUBJECTS.filter(s => !usedSubjects.includes(s) || s === subject.name).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={subject.mark || ''}
                        onChange={(e) => updateSubject(index, 'mark', parseInt(e.target.value) || 0)}
                        placeholder="%"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-center"
                      />
                    </div>
                    {subjects.length > 1 && (
                      <button onClick={() => removeSubject(index)} title="Remove subject" className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {subjects.length < 9 && (
                <button
                  onClick={addSubject}
                  className="flex items-center gap-2 text-blue-700 text-sm font-medium hover:text-blue-800 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Subject
                </button>
              )}

              {/* APS Calculator */}
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">Estimated APS Score</p>
                    <p className="text-xs text-blue-600 mt-0.5">Based on your best 6 subjects (excl. Life Orientation)</p>
                  </div>
                  <div className="text-3xl font-bold text-blue-700">{apsScore}</div>
                </div>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div
                    className={`bg-blue-600 rounded-full h-2 transition-all ${apsProgressWidthClass}`}
                  />
                </div>
                <p className="text-xs text-blue-500 mt-1">Maximum APS: 42</p>
              </div>
            </div>
          )}

          {/* Step 3: Career Interests */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-1">Career Interests</h2>
                <p className="text-sm text-gray-500">Select fields that interest you (choose at least 1)</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CAREER_INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                      interests.includes(interest)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>

              {interests.length > 0 && (
                <p className="text-sm text-green-600 font-medium">
                  {interests.length} interest{interests.length > 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip for now
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition-colors"
              >
                Next <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={loading || interests.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-700 to-green-600 text-white font-medium rounded-lg hover:from-blue-800 hover:to-green-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                Complete Profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetup;
