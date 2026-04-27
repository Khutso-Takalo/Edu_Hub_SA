import React, { useState } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, Loader2 } from 'lucide-react';
import { CAREER_INTEREST_OPTIONS, PROVINCES, GRADE_LEVELS } from '@/data/staticData';
import type { SignUpPersonaContext } from '@/hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuth: {
    signUp: (email: string, password: string, fullName: string, personaContext?: SignUpPersonaContext) => Promise<unknown>;
    signIn: (email: string, password: string) => Promise<unknown>;
    verifyMfa?: (code: string) => Promise<unknown>;
    resetPassword: (email: string) => Promise<void>;
  };
}

type AuthTab = 'login' | 'signup' | 'reset' | 'mfa';

const LOGIN_ATTEMPT_STORAGE_KEY = 'eduhub:auth-login-attempts:v1';
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 60 * 1000;

interface LoginAttemptStore {
  failedAttempts: string[];
  lockoutUntil?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

const PERSONA_OPTIONS: Array<{ value: SignUpPersonaContext['personaType']; label: string }> = [
  { value: 'learner', label: 'Learner (high school or college applicant)' },
  { value: 'parent_guardian', label: 'Parent or guardian supporting a learner' },
  { value: 'teacher_counselor', label: 'Teacher or counselor supporting students' },
  { value: 'graduate_upskiller', label: 'Graduate or upskiller seeking next opportunity' },
];

const readLoginAttemptStore = (): LoginAttemptStore => {
  if (typeof window === 'undefined') return { failedAttempts: [] };

  try {
    const raw = window.localStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY);
    if (!raw) return { failedAttempts: [] };
    const parsed = JSON.parse(raw) as Partial<LoginAttemptStore>;
    return {
      failedAttempts: Array.isArray(parsed.failedAttempts) ? parsed.failedAttempts : [],
      lockoutUntil: parsed.lockoutUntil,
    };
  } catch {
    return { failedAttempts: [] };
  }
};

const writeLoginAttemptStore = (store: LoginAttemptStore) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify(store));
};

const clearLoginAttemptStore = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOGIN_ATTEMPT_STORAGE_KEY);
};

const isLockedOut = () => {
  const store = readLoginAttemptStore();
  if (!store.lockoutUntil) return { locked: false, remainingMs: 0 };
  const remainingMs = new Date(store.lockoutUntil).getTime() - Date.now();
  return {
    locked: remainingMs > 0,
    remainingMs: Math.max(0, remainingMs),
  };
};

const registerFailedAttempt = () => {
  const now = Date.now();
  const store = readLoginAttemptStore();
  const recentAttempts = store.failedAttempts.filter((iso) => now - new Date(iso).getTime() <= ATTEMPT_WINDOW_MS);
  const nextAttempts = [...recentAttempts, new Date(now).toISOString()];

  if (nextAttempts.length >= MAX_FAILED_ATTEMPTS) {
    writeLoginAttemptStore({
      failedAttempts: nextAttempts,
      lockoutUntil: new Date(now + LOCKOUT_MS).toISOString(),
    });
    return true;
  }

  writeLoginAttemptStore({
    failedAttempts: nextAttempts,
  });
  return false;
};

const toFriendlyAuthError = (tab: AuthTab, rawMessage?: string) => {
  const message = (rawMessage || '').toLowerCase();

  if (tab === 'login') {
    if (message.includes('invalid login') || message.includes('invalid credentials')) {
      return 'Sign in failed. Check your email/password or reset your password.';
    }
    return 'Sign in failed. Please try again in a moment.';
  }

  if (tab === 'signup') {
    if (message.includes('already registered') || message.includes('already exists')) {
      return 'This email is already registered. Try signing in instead.';
    }
    return 'Could not create account right now. Please try again.';
  }

  return 'If this email is registered, a reset link will be sent.';
};

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) {
    return err.message;
  }

  return undefined;
};

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuth }) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [personaType, setPersonaType] = useState<SignUpPersonaContext['personaType'] | ''>('');
  const [personaGradeLevel, setPersonaGradeLevel] = useState('');
  const [personaProvince, setPersonaProvince] = useState('');
  const [personaInterests, setPersonaInterests] = useState<string[]>([]);
  const [personaKeywordInput, setPersonaKeywordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (tab === 'login') {
      const lock = isLockedOut();
      if (lock.locked) {
        setError(`Too many attempts. Try again in ${Math.ceil(lock.remainingMs / 1000)}s.`);
        return;
      }
    }

    setLoading(true);

    try {
      if (tab === 'signup') {
        if (!fullName.trim()) throw new Error('Please enter your full name');
        if (!PASSWORD_POLICY_REGEX.test(password)) {
          throw new Error('Password must be at least 8 characters and include letters and numbers.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.');
        }

        if (!personaType) {
          throw new Error('Select who this account is for so we can personalize your data feed.');
        }

        if (personaInterests.length === 0) {
          throw new Error('Choose at least one interest for persona-based scraping and recommendations.');
        }

        const scrapeFocusKeywords = personaKeywordInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 8);

        const personaContext: SignUpPersonaContext = {
          personaType,
          educationStage: personaGradeLevel || undefined,
          province: personaProvince || undefined,
          careerInterests: personaInterests,
          scrapeFocusKeywords,
        };

        await onAuth.signUp(normalizedEmail, password, fullName.trim(), personaContext);
        setSuccess('Account created! Please check your email to verify your account, or you may be logged in automatically.');
        setTimeout(() => onClose(), 2000);
      } else if (tab === 'login') {
        await onAuth.signIn(normalizedEmail, password);
        clearLoginAttemptStore();
        onClose();
      } else if (tab === 'mfa') {
        if (!onAuth.verifyMfa) {
          throw new Error('Multi-factor authentication is unavailable right now.');
        }

        await onAuth.verifyMfa(mfaCode);
        clearLoginAttemptStore();
        setSuccess('Verification successful.');
        setTimeout(() => onClose(), 800);
      } else {
        await onAuth.resetPassword(normalizedEmail);
        setSuccess('If this email is registered, a reset link has been sent.');
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err);

      if (tab === 'login' && message === 'MFA_REQUIRED') {
        setTab('mfa');
        setError('');
        setSuccess('Enter your authenticator app code to finish signing in.');
      } else if (tab === 'login') {
        const locked = registerFailedAttempt();
        if (locked) {
          setError('Too many sign-in attempts. Please wait 60 seconds and try again.');
        } else {
          setError(toFriendlyAuthError(tab, message));
        }
      } else if (tab === 'mfa') {
        setError('Invalid or expired MFA code. Please try again.');
      } else if (tab === 'reset') {
        setSuccess('If this email is registered, a reset link has been sent.');
      } else {
        setError(toFriendlyAuthError(tab, message));
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setMfaCode('');
    setFullName('');
    setPersonaType('');
    setPersonaGradeLevel('');
    setPersonaProvince('');
    setPersonaInterests([]);
    setPersonaKeywordInput('');
    setError('');
    setSuccess('');
  };

  const togglePersonaInterest = (interest: string) => {
    setPersonaInterests((previous) =>
      previous.includes(interest)
        ? previous.filter((item) => item !== interest)
        : [...previous, interest]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="my-4 sm:my-0 bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header with SA-inspired gradient */}
        <div className="bg-gradient-to-r from-blue-700 via-green-600 to-yellow-500 p-4 sm:p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
            title="Close modal"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-white">
            {tab === 'login' ? 'Welcome Back!' : tab === 'signup' ? 'Join EduHub SA' : tab === 'mfa' ? 'Multi-Factor Check' : 'Reset Password'}
          </h2>
          <p className="text-white/80 text-sm mt-1">
            {tab === 'login'
              ? 'Sign in to access your personalized dashboard'
              : tab === 'signup'
                ? 'Start your journey to educational success'
                : tab === 'mfa'
                  ? 'Verify with your authenticator app'
                  : 'We\'ll send you a reset link'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 shrink-0">
          {(['login', 'signup', 'reset'] as AuthTab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); resetForm(); }}
              className={`flex-1 py-2.5 sm:py-3 text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-blue-700 border-b-2 border-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'login' ? 'Sign In' : t === 'signup' ? 'Sign Up' : 'Reset'}
            </button>
          ))}
          {tab === 'mfa' && (
            <button
              onClick={() => { setTab('login'); setPassword(''); setMfaCode(''); setError(''); setSuccess(''); }}
              className="flex-1 py-3 text-sm font-medium text-blue-700 border-b-2 border-blue-700"
            >
              Verify
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto min-h-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          {tab === 'signup' && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>
          )}

          {tab === 'signup' && (
            <div className="space-y-2">
              <label htmlFor="signup-persona" className="block text-xs font-medium text-gray-600">Account persona</label>
              <select
                id="signup-persona"
                value={personaType}
                onChange={(event) => setPersonaType(event.target.value as SignUpPersonaContext['personaType'])}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                required
              >
                <option value="">Select persona...</option>
                {PERSONA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          {tab === 'signup' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-2">
                <label htmlFor="signup-grade-level" className="block text-xs font-medium text-gray-600">Education stage (optional)</label>
                <select
                  id="signup-grade-level"
                  value={personaGradeLevel}
                  onChange={(event) => setPersonaGradeLevel(event.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                >
                  <option value="">Select stage...</option>
                  {GRADE_LEVELS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="signup-province" className="block text-xs font-medium text-gray-600">Province focus (optional)</label>
                <select
                  id="signup-province"
                  value={personaProvince}
                  onChange={(event) => setPersonaProvince(event.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                >
                  <option value="">All provinces</option>
                  {PROVINCES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {tab === 'signup' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Top interests for persona scraping</p>
              <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto pr-1">
                {CAREER_INTEREST_OPTIONS.slice(0, 12).map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => togglePersonaInterest(interest)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      personaInterests.includes(interest)
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'signup' && (
            <div className="space-y-2">
              <label htmlFor="signup-keywords" className="block text-xs font-medium text-gray-600">Priority keywords (optional)</label>
              <input
                id="signup-keywords"
                type="text"
                placeholder="e.g. medicine, nursing, Gauteng bursary"
                value={personaKeywordInput}
                onChange={(event) => setPersonaKeywordInput(event.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
              <p className="text-[11px] text-gray-500">Separate keywords with commas to guide scraping and ranking.</p>
            </div>
          )}

          {tab !== 'mfa' && (
            <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              required
            />
            </div>
          )}

          {tab !== 'reset' && tab !== 'signup' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}

          {tab === 'signup' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-11 pr-11 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}

          {tab === 'mfa' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="6-digit authenticator code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all tracking-[0.25em]"
                required
                minLength={6}
                maxLength={6}
              />
            </div>
          )}

          {tab === 'signup' && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
                minLength={8}
              />
            </div>
          )}

          {tab === 'signup' && (
            <p className="text-xs text-gray-500 -mt-2">
              Use at least 8 characters, including letters and numbers.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-700 to-green-600 text-white font-semibold rounded-lg hover:from-blue-800 hover:to-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {tab === 'login' ? 'Sign In' : tab === 'signup' ? 'Create Account' : tab === 'mfa' ? 'Verify Code' : 'Send Reset Link'}
          </button>

          {tab === 'login' && (
            <p className="text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <button type="button" onClick={() => { setTab('signup'); resetForm(); }} className="text-blue-700 font-medium hover:underline">
                Sign up free
              </button>
            </p>
          )}
          {tab === 'signup' && (
            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <button type="button" onClick={() => { setTab('login'); resetForm(); }} className="text-blue-700 font-medium hover:underline">
                Sign in
              </button>
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
