import { useState, useEffect, useCallback } from 'react';
import { supabase, runtimeEnvMessages, runtimeEnvStatus } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  grade_level: string;
  subjects: { name: string; mark: number }[];
  aps_score: number;
  career_interests: string[];
  province: string;
  saved_bursaries: string[];
  saved_institutions: string[];
  saved_careers: string[];
  isPremium?: boolean;
  profile_completed: boolean;
}

export interface SignUpPersonaContext {
  personaType: 'learner' | 'parent_guardian' | 'teacher_counselor' | 'graduate_upskiller';
  educationStage?: string;
  province?: string;
  careerInterests: string[];
  scrapeFocusKeywords: string[];
}

export interface MfaFactorSummary {
  id: string;
  factorType: string;
  status: 'verified' | 'unverified';
  friendlyName?: string;
  createdAt?: string;
}

export interface MfaEnrollmentPayload {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mfaFactors, setMfaFactors] = useState<MfaFactorSummary[]>([]);
  const [pendingMfaChallenge, setPendingMfaChallenge] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [authConfigError, setAuthConfigError] = useState<string | null>(
    runtimeEnvStatus.isSupabaseConfigured ? null : runtimeEnvMessages.missingSupabaseConfig
  );

  const readUserMetadataRole = useCallback((): string | null => {
    const role = (user?.user_metadata as { role?: string } | undefined)?.role;
    if (!role || typeof role !== 'string') return null;
    return role.trim().toLowerCase();
  }, [user]);

  const isAdmin = (profile?.role || '').toLowerCase() === 'admin' || readUserMetadataRole() === 'admin';

  const requireSupabase = useCallback(() => {
    if (!supabase) {
      throw new Error(runtimeEnvMessages.missingSupabaseConfig);
    }

    return supabase;
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const client = requireSupabase();

    try {
      const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      setProfile(data as UserProfile);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  }, [requireSupabase]);

  const refreshMfaFactors = useCallback(async () => {
    const client = requireSupabase();

    if (!user) {
      setMfaFactors([]);
      return [] as MfaFactorSummary[];
    }

    try {
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw error;

      const factors = (data?.all || []).map((factor) => ({
        id: factor.id,
        factorType: factor.factor_type,
        status: factor.status,
        friendlyName: factor.friendly_name || undefined,
        createdAt: factor.created_at || undefined,
      }));

      setMfaFactors(factors);
      return factors;
    } catch (err) {
      console.error('Error loading MFA factors:', err);
      setMfaFactors([]);
      return [] as MfaFactorSummary[];
    }
  }, [requireSupabase, user]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setSession(null);
      setUser(null);
      setProfile(null);
      setMfaFactors([]);
      setPendingMfaChallenge(null);
      setAuthConfigError(runtimeEnvMessages.missingSupabaseConfig);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        void refreshMfaFactors();
      } else {
        setMfaFactors([]);
        setPendingMfaChallenge(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        void refreshMfaFactors();
      } else {
        setProfile(null);
        setMfaFactors([]);
        setPendingMfaChallenge(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, refreshMfaFactors]);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    personaContext?: SignUpPersonaContext
  ) => {
    const client = requireSupabase();
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedFullName = fullName.trim();

    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        data: {
          full_name: trimmedFullName,
          signup_persona: personaContext || null,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const client = requireSupabase();
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) throw error;

    const { data: aalData, error: aalError } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) throw aalError;

    if (aalData?.nextLevel === 'aal2') {
      const { data: factorData, error: factorError } = await client.auth.mfa.listFactors();
      if (factorError) throw factorError;

      const preferredFactor = factorData?.totp?.[0] || factorData?.all?.find((factor) => factor.status === 'verified');
      if (preferredFactor?.id) {
        const { data: challengeData, error: challengeError } = await client.auth.mfa.challenge({
          factorId: preferredFactor.id,
        });
        if (challengeError) throw challengeError;

        setPendingMfaChallenge({
          factorId: preferredFactor.id,
          challengeId: challengeData.id,
        });

        const mfaRequiredError = new Error('MFA_REQUIRED');
        throw mfaRequiredError;
      }
    }

    await refreshMfaFactors();
    return data;
  };

  const verifyMfa = async (code: string) => {
    const client = requireSupabase();
    if (!pendingMfaChallenge) {
      throw new Error('No MFA verification is pending. Sign in again to request a new code.');
    }

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new Error('Enter the verification code from your authenticator app.');
    }

    const { data, error } = await client.auth.mfa.verify({
      factorId: pendingMfaChallenge.factorId,
      challengeId: pendingMfaChallenge.challengeId,
      code: trimmedCode,
    });

    if (error) throw error;

    setPendingMfaChallenge(null);
    if (data?.user?.id) {
      await fetchProfile(data.user.id);
    }
    await refreshMfaFactors();
    return data;
  };

  const enrollMfaTotp = async (): Promise<MfaEnrollmentPayload> => {
    const client = requireSupabase();
    if (!user) throw new Error('Sign in first to enroll MFA.');

    const { data, error } = await client.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'EduHub Authenticator',
    });
    if (error) throw error;

    await refreshMfaFactors();

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  };

  const verifyMfaEnrollment = async (factorId: string, code: string) => {
    const client = requireSupabase();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new Error('Enter the verification code from your authenticator app.');
    }

    const { data, error } = await client.auth.mfa.challengeAndVerify({
      factorId,
      code: trimmedCode,
    });
    if (error) throw error;

    if (data?.user?.id) {
      await fetchProfile(data.user.id);
    }
    await refreshMfaFactors();
    return data;
  };

  const unenrollMfaFactor = async (factorId: string) => {
    const client = requireSupabase();
    const { error } = await client.auth.mfa.unenroll({ factorId });
    if (error) throw error;

    await refreshMfaFactors();
  };

  const signOut = async () => {
    const client = requireSupabase();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setMfaFactors([]);
    setPendingMfaChallenge(null);
  };

  const resetPassword = async (email: string) => {
    const client = requireSupabase();
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
    });
    if (error) throw error;
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const client = requireSupabase();
    if (!user) throw new Error('Not authenticated');
    const { error } = await client
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  };

  const updateSignupPersonaContext = async (personaContext: SignUpPersonaContext) => {
    const client = requireSupabase();
    if (!user) throw new Error('Not authenticated');

    // Keep profile table as primary read model for personalization fields.
    await updateProfile({
      grade_level: personaContext.educationStage || profile?.grade_level || '',
      province: personaContext.province || profile?.province || '',
      career_interests: personaContext.careerInterests,
    });

    const { error } = await client.auth.updateUser({
      data: {
        ...(user?.user_metadata || {}),
        signup_persona: personaContext,
      },
    });

    if (error) throw error;
  };

  const toggleSavedBursary = async (bursaryId: string) => {
    if (!profile) return;
    const saved = profile.saved_bursaries || [];
    const updated = saved.includes(bursaryId)
      ? saved.filter(id => id !== bursaryId)
      : [...saved, bursaryId];
    await updateProfile({ saved_bursaries: updated });
  };

  const toggleSavedInstitution = async (institutionId: string) => {
    if (!profile) return;
    const saved = profile.saved_institutions || [];
    const updated = saved.includes(institutionId)
      ? saved.filter(id => id !== institutionId)
      : [...saved, institutionId];
    await updateProfile({ saved_institutions: updated });
  };

  const toggleSavedCareer = async (careerId: string) => {
    if (!profile) return;
    const saved = profile.saved_careers || [];
    const updated = saved.includes(careerId)
      ? saved.filter(id => id !== careerId)
      : [...saved, careerId];
    await updateProfile({ saved_careers: updated });
  };

  return {
    user,
    session,
    profile,
    mfaFactors,
    pendingMfaChallenge,
    mfaEnabled: mfaFactors.some((factor) => factor.status === 'verified'),
    loading,
    signUp,
    signIn,
    signOut,
    verifyMfa,
    refreshMfaFactors,
    enrollMfaTotp,
    verifyMfaEnrollment,
    unenrollMfaFactor,
    resetPassword,
    updateProfile,
    updateSignupPersonaContext,
    fetchProfile,
    isAdmin,
    toggleSavedBursary,
    toggleSavedInstitution,
    toggleSavedCareer,
    authConfigError,
    isAuthConfigured: runtimeEnvStatus.isSupabaseConfigured,
  };
}
