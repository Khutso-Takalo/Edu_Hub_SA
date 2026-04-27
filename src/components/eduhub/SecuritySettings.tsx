import React, { useMemo, useState } from 'react';
import { ShieldCheck, Smartphone, RefreshCcw, QrCode, KeyRound, Trash2, CheckCircle2 } from 'lucide-react';
import type { MfaFactorSummary, MfaEnrollmentPayload } from '@/hooks/useAuth';

interface SecuritySettingsProps {
  mfaEnabled: boolean;
  mfaFactors: MfaFactorSummary[];
  onRefreshMfaFactors: () => Promise<MfaFactorSummary[]>;
  onEnrollMfaTotp: () => Promise<MfaEnrollmentPayload>;
  onVerifyMfaEnrollment: (factorId: string, code: string) => Promise<unknown>;
  onUnenrollMfaFactor: (factorId: string) => Promise<void>;
  onNavigate: (view: string) => void;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  mfaEnabled,
  mfaFactors,
  onRefreshMfaFactors,
  onEnrollMfaTotp,
  onVerifyMfaEnrollment,
  onUnenrollMfaFactor,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(false);
  const [enrollment, setEnrollment] = useState<MfaEnrollmentPayload | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const verifiedFactors = useMemo(
    () => mfaFactors.filter((factor) => factor.status === 'verified'),
    [mfaFactors],
  );

  const enrollmentQr = useMemo(() => {
    if (!enrollment?.qrCode) return null;

    if (enrollment.qrCode.startsWith('<svg')) {
      return { kind: 'svg' as const, value: enrollment.qrCode };
    }

    return { kind: 'img' as const, value: enrollment.qrCode };
  }, [enrollment]);

  const runAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await action();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : null;
      setError(message || 'Could not complete this action.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    void runAction(async () => {
      await onRefreshMfaFactors();
      setSuccess('Security factors refreshed.');
    });
  };

  const handleBeginEnrollment = () => {
    void runAction(async () => {
      const payload = await onEnrollMfaTotp();
      setEnrollment(payload);
      setVerificationCode('');
      setSuccess('Scan the QR code, then enter the 6-digit code from your authenticator app.');
    });
  };

  const handleVerifyEnrollment = () => {
    if (!enrollment?.factorId) {
      setError('Start enrollment first to verify MFA.');
      return;
    }

    if (verificationCode.trim().length !== 6) {
      setError('Enter a valid 6-digit verification code.');
      return;
    }

    void runAction(async () => {
      await onVerifyMfaEnrollment(enrollment.factorId, verificationCode);
      await onRefreshMfaFactors();
      setEnrollment(null);
      setVerificationCode('');
      setSuccess('Multi-factor authentication is now enabled.');
    });
  };

  const handleRemoveFactor = (factorId: string) => {
    void runAction(async () => {
      await onUnenrollMfaFactor(factorId);
      await onRefreshMfaFactors();
      setSuccess('Authenticator removed.');
    });
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-700" />
              Security Settings
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Protect your account with multi-factor authentication and manage trusted factors.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${
                mfaEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {mfaEnabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
              {mfaEnabled ? 'MFA enabled' : 'MFA not enabled'}
            </span>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {(error || success) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {error || success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-700" />
            Authenticator App
          </h2>
          <p className="text-sm text-gray-600 mt-2">
            Add an authenticator app to require a one-time code during sign-in.
          </p>

          {!enrollment && (
            <button
              type="button"
              onClick={handleBeginEnrollment}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-700 to-green-600 px-4 py-2 text-sm font-semibold text-white hover:from-blue-800 hover:to-green-700 disabled:opacity-60"
            >
              <QrCode className="w-4 h-4" />
              Set up MFA
            </button>
          )}

          {enrollment && (
            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-900">Scan this QR code</p>
                <p className="text-xs text-gray-600 mt-1">Use Google Authenticator, Microsoft Authenticator, or a compatible app.</p>
                <div className="mt-4 flex justify-center">
                  {enrollmentQr?.kind === 'svg' ? (
                    <div className="rounded-lg bg-white p-3" dangerouslySetInnerHTML={{ __html: enrollmentQr.value }} />
                  ) : enrollmentQr?.kind === 'img' ? (
                    <img src={enrollmentQr.value} alt="MFA QR code" className="h-48 w-48 rounded-lg border border-gray-200 bg-white p-2" />
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-gray-500 break-all">Secret: {enrollment.secret}</p>
              </div>

              <div>
                <label htmlFor="mfa-enrollment-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Verification code
                </label>
                <input
                  id="mfa-enrollment-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit code"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm tracking-[0.2em] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleVerifyEnrollment}
                  disabled={loading}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  Verify and Enable
                </button>
                <button
                  type="button"
                  onClick={() => { setEnrollment(null); setVerificationCode(''); setError(''); setSuccess(''); }}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Active Security Factors</h2>
          <p className="text-sm text-gray-600 mt-2">
            Remove old devices if you no longer use them.
          </p>

          <div className="mt-4 space-y-3">
            {verifiedFactors.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-600">
                No verified factors yet.
              </p>
            )}

            {verifiedFactors.map((factor) => (
              <div key={factor.id} className="rounded-lg border border-gray-200 px-3 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{factor.friendlyName || 'Authenticator app'}</p>
                  <p className="text-xs text-gray-500">
                    {factor.factorType.toUpperCase()} • Added {factor.createdAt ? new Date(factor.createdAt).toLocaleDateString('en-ZA') : 'unknown'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFactor(factor.id)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>
    </section>
  );
};

export default SecuritySettings;
