import { useMemo, useState } from 'react';
import type { SignUpPersonaContext, UserProfile } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProfileSetupModalProps {
  open: boolean;
  profile: UserProfile;
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

const GRADE_OPTIONS = [
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
  'TVET College',
  'University',
  'Unemployed Graduate',
];

const PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Eastern Cape',
  'Free State',
  'Limpopo',
  'Mpumalanga',
  'North West',
  'Northern Cape',
];

export function ProfileSetupModal({
  open,
  profile,
  onSave,
  signupPersonaContext,
  onSaveSignupPersona,
  onComplete,
}: ProfileSetupModalProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [grade, setGrade] = useState(profile.grade_level || '');
  const [apsScore, setApsScore] = useState(profile.aps_score ? String(profile.aps_score) : '');
  const [province, setProvince] = useState(profile.province || '');
  const [personaType, setPersonaType] = useState<SignUpPersonaContext['personaType']>(
    signupPersonaContext?.personaType || 'learner'
  );
  const [personaKeywordInput, setPersonaKeywordInput] = useState(
    (signupPersonaContext?.scrapeFocusKeywords || []).join(', ')
  );

  const canContinue = useMemo(() => {
    if (step === 1) return grade.trim().length > 0;
    if (step === 2) return true;
    if (step === 3) return province.trim().length > 0;
    return false;
  }, [grade, province, step]);

  const handleComplete = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({
        grade_level: grade,
        aps_score: apsScore ? Number.parseInt(apsScore, 10) : profile.aps_score,
        province,
        profile_completed: true,
      });

      if (onSaveSignupPersona) {
        await onSaveSignupPersona({
          personaType,
          educationStage: grade || undefined,
          province: province || undefined,
          careerInterests: profile.career_interests || [],
          scrapeFocusKeywords: personaKeywordInput
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 8),
        });
      }

      onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-xs sm:max-w-md p-3 sm:p-6" aria-describedby="onboarding-profile-desc">
        <DialogHeader>
          <DialogTitle>Let&apos;s personalize EduHub for you</DialogTitle>
          <p id="onboarding-profile-desc" className="text-sm text-muted-foreground">
            Quick setup to unlock personalized bursary recommendations.
          </p>
        </DialogHeader>

        <div className="mb-2 flex items-center gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 p-2 sm:p-3">
          <p className="text-xs font-medium text-blue-900">Scraping persona summary</p>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-blue-800">
              Persona
              <select
                value={personaType}
                onChange={(event) => setPersonaType(event.target.value as SignUpPersonaContext['personaType'])}
                className="mt-1 w-full rounded border border-blue-200 bg-white px-2 py-1"
              >
                {PERSONA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-blue-800">
              Priority keywords
              <input
                value={personaKeywordInput}
                onChange={(event) => setPersonaKeywordInput(event.target.value)}
                placeholder="e.g. nursing, Gauteng bursary"
                className="mt-1 w-full rounded border border-blue-200 bg-white px-2 py-1"
              />
            </label>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What is your current grade or status?</p>
            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger title="Select grade level">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {GRADE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setStep(2)} disabled={!canContinue} className="w-full">
              Continue
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">What is your APS score? (Optional)</p>
            <Input
              type="number"
              min={0}
              max={42}
              placeholder="e.g., 34"
              value={apsScore}
              onChange={(event) => setApsScore(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Which province are you in?</p>
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger title="Select province">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={handleComplete} disabled={!canContinue || saving} className="flex-1">
                {saving ? 'Saving...' : 'Finish'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
