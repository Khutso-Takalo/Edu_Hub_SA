import React, { useMemo, useState } from 'react';
import { Crown, CheckCircle2, XCircle, CreditCard } from 'lucide-react';
import type { UserProfile } from '@/hooks/useAuth';
import { toast } from '@/components/ui/use-toast';

interface PremiumSettingsProps {
  profile: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  onNavigate: (view: string) => void;
}

const PremiumSettings: React.FC<PremiumSettingsProps> = ({ profile, onUpdateProfile, onNavigate }) => {
  const [saving, setSaving] = useState(false);
  const isPremium = !!profile.isPremium;

  const entitlements = useMemo(
    () => [
      { id: 'templates', title: 'Extra CV templates', enabled: isPremium, detail: 'Creative and Minimal templates' },
      { id: 'word', title: 'Word export', enabled: isPremium, detail: 'Export CV as DOCX' },
      { id: 'ats', title: 'Advanced ATS analytics', enabled: isPremium, detail: 'Analyze CV keyword and formatting fit' },
    ],
    [isPremium]
  );

  const togglePremium = async () => {
    setSaving(true);
    try {
      await onUpdateProfile({ isPremium: !isPremium });
      toast({
        title: !isPremium ? 'Premium enabled' : 'Premium disabled',
        description: !isPremium
          ? 'Premium entitlements are now active on your profile.'
          : 'Profile reverted to free-tier entitlements.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Crown className="w-6 h-6 text-amber-600" /> Premium Settings
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          Premium features are optional and do not affect core student access.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPremium ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
            {isPremium ? 'Premium Active' : 'Free Plan'}
          </span>
          <button
            onClick={() => void togglePremium()}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-300 text-sm"
          >
            {saving ? 'Saving...' : isPremium ? 'Switch to Free Plan' : 'Activate Premium'}
          </button>
          <a
            href="https://payfast.io"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-100 text-sm inline-flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" /> Open payment page
          </a>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Entitlements</h2>
        <div className="space-y-2">
          {entitlements.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.title}</p>
                <p className="text-xs text-gray-600">{item.detail}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${item.enabled ? 'text-emerald-700' : 'text-gray-500'}`}>
                {item.enabled ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {item.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <button
            onClick={() => onNavigate('cv-builder')}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
          >
            Open CV Builder
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumSettings;