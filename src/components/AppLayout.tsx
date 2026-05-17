import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useApplications } from '@/hooks/useApplications';
import { useNotifications } from '@/hooks/useNotifications';
import Navbar from '@/components/eduhub/Navbar';
import AuthModal from '@/components/eduhub/AuthModal';
import Footer from '@/components/eduhub/Footer';
import PwaStatusBanner from '@/components/eduhub/PwaStatusBanner';
import { toast } from '@/components/ui/use-toast';
import { ProfileSetupModal } from '@/components/onboarding/ProfileSetupModal';

const HeroSection = lazy(() => import('@/components/eduhub/HeroSection'));
const Dashboard = lazy(() => import('@/components/eduhub/Dashboard'));
const ProfileSetup = lazy(() => import('@/components/eduhub/ProfileSetup'));
const CareerExplorer = lazy(() => import('@/components/eduhub/CareerExplorer'));
const BursarySearch = lazy(() => import('@/components/eduhub/BursarySearch'));
const InstitutionFinder = lazy(() => import('@/components/eduhub/InstitutionFinder'));
const PastPapers = lazy(() => import('@/components/eduhub/PastPapers'));
const ResourceGuides = lazy(() => import('@/components/eduhub/ResourceGuides'));
const KnowledgeHub = lazy(() => import('@/components/eduhub/KnowledgeHub'));
const SearchResults = lazy(() => import('@/components/eduhub/SearchResults'));
const ApplicationTracker = lazy(() => import('@/components/eduhub/ApplicationTracker'));
const CVBuilder = lazy(() => import('@/components/eduhub/CVBuilder'));
const EssayStudio = lazy(() => import('@/components/eduhub/EssayStudio'));
const SecuritySettings = lazy(() => import('@/components/eduhub/SecuritySettings'));
const ClassroomMode = lazy(() => import('@/components/eduhub/ClassroomMode'));
const PremiumSettings = lazy(() => import('@/components/eduhub/PremiumSettings'));
const AdminPanel = lazy(() => import('@/components/eduhub/AdminPanel'));
const BursaryDetail = lazy(() => import('@/components/eduhub/BursaryDetail'));
const CareerAdvisorChat = lazy(() => import('@/components/eduhub/CareerAdvisorChat'));

const SEARCH_HISTORY_STORAGE_KEY = 'eduhub:search-history:v1';
const SIGNUP_PERSONA_SEED_KEY = 'eduhub:signup-persona-seeded:v1';

type SignupPersonaMetadata = {
  personaType?: 'learner' | 'parent_guardian' | 'teacher_counselor' | 'graduate_upskiller';
  educationStage?: string;
  province?: string;
  careerInterests?: string[];
  scrapeFocusKeywords?: string[];
};

const getInitialView = (): ViewType => {
  if (typeof window === 'undefined') return 'home';
  if (window.location.pathname === '/classroom') return 'classroom';
  return 'home';
};

type ViewType =
  | 'home'
  | 'dashboard'
  | 'profile'
  | 'careers'
  | 'bursaries'
  | 'bursary-detail'
  | 'institutions'
  | 'papers'
  | 'resources'
  | 'knowledge'
  | 'tracker'
  | 'search'
  | 'admin'
  | 'security'
  | 'premium'
  | 'classroom'
  | 'cv-builder'
  | 'essay-studio';

const AppLayout: React.FC = () => {
  const {
    user, profile, loading,
    signUp, signIn, signOut, verifyMfa, resetPassword,
    mfaEnabled, mfaFactors, refreshMfaFactors, enrollMfaTotp, verifyMfaEnrollment, unenrollMfaFactor,
    isAdmin,
    updateProfile, updateSignupPersonaContext, toggleSavedBursary, toggleSavedInstitution, toggleSavedCareer,
    authConfigError,
  } = useAuth();

  const signupPersonaContext = useMemo(() => {
    const metadataPersona = ((user?.user_metadata || {}) as { signup_persona?: SignupPersonaMetadata }).signup_persona || null;

    const hasProfilePersonaSignals = Boolean(profile?.grade_level || profile?.province || (profile?.career_interests || []).length > 0);
    if (!metadataPersona && !hasProfilePersonaSignals) {
      return null;
    }

    return {
      personaType: metadataPersona?.personaType || 'learner',
      educationStage: profile?.grade_level || metadataPersona?.educationStage,
      province: profile?.province || metadataPersona?.province,
      careerInterests: (profile?.career_interests || metadataPersona?.careerInterests || []).slice(0, 8),
      scrapeFocusKeywords: (metadataPersona?.scrapeFocusKeywords || []).slice(0, 8),
    };
  }, [profile, user]);

  const {
    applications,
    trackedBursaryIds,
    upcomingDeadlines,
    addApplication,
    updateStatus,
    updateNotes,
    toggleChecklistItem,
    removeApplication,
    importApplications,
  } = useApplications(user?.id);

  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    createDeadlineReminder,
    updateReminder,
    cancelReminder,
  } = useNotifications(user?.id, applications);

  const [currentView, setCurrentView] = useState<ViewType>(getInitialView);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as string[];
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showQuickOnboarding, setShowQuickOnboarding] = useState(false);
  const [selectedBursaryId, setSelectedBursaryId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Check if user needs profile setup after login
  useEffect(() => {
    if (!user || !profile) {
      setShowQuickOnboarding(false);
      return;
    }

    const needsQuickProfile = !profile.grade_level || !profile.province;
    setShowQuickOnboarding(needsQuickProfile && currentView !== 'profile');
  }, [user, profile, currentView]);

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

    const seedKey = `${SIGNUP_PERSONA_SEED_KEY}:${user.id}`;
    if (localStorage.getItem(seedKey) === 'done') {
      return;
    }

    const metadata = user.user_metadata as {
      signup_persona?: SignupPersonaMetadata;
    };

    const persona = metadata?.signup_persona;
    if (!persona) {
      localStorage.setItem(seedKey, 'done');
      return;
    }

    const updates: Partial<typeof profile> = {};
    if (!profile.grade_level && persona.educationStage) {
      updates.grade_level = persona.educationStage;
    }

    if (!profile.province && persona.province) {
      updates.province = persona.province;
    }

    if ((!profile.career_interests || profile.career_interests.length === 0) && Array.isArray(persona.careerInterests)) {
      updates.career_interests = persona.careerInterests.slice(0, 6);
    }

    if (Object.keys(updates).length === 0) {
      localStorage.setItem(seedKey, 'done');
      return;
    }

    updateProfile(updates)
      .then(() => {
        localStorage.setItem(seedKey, 'done');
      })
      .catch((error) => {
        console.error('Could not seed profile from signup persona metadata', error);
      });
  }, [user, profile, updateProfile]);

  const handleNavigate = (view: string) => {
    if ((view === 'dashboard' || view === 'tracker' || view === 'admin' || view === 'security' || view === 'premium') && !user) {
      setShowAuthModal(true);
      return;
    }

    if (view === 'admin' && user && !isAdmin) {
      toast({
        title: 'Admin access required',
        description: 'Your account does not have permission to open Data Lab.',
        variant: 'destructive',
      });
      return;
    }

    setCurrentView(view as ViewType);
    if (typeof window !== 'undefined') {
      const nextPath = view === 'classroom' ? '/classroom' : '/';
      window.history.replaceState({}, '', nextPath);
    }
    setSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    setSearchQuery(normalized);
    setSearchHistory((previous) => {
      const next = [normalized, ...previous.filter((item) => item.toLowerCase() !== normalized.toLowerCase())];
      return next.slice(0, 8);
    });
    setCurrentView('search');
  };

  const handleOpenBursaryDetail = (bursaryId: string) => {
    setSelectedBursaryId(bursaryId);
    setCurrentView('bursary-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthClick = () => {
    setShowAuthModal(true);
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentView('home');
    setShowProfileSetup(false);
    setSelectedBursaryId(null);
  };

  const handleProfileComplete = () => {
    setShowProfileSetup(false);
    setCurrentView('dashboard');
  };

  const handleTrackApplication = async (bursary: { id: string; name: string; deadline: string }) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const existing = applications.find((item) => item.bursaryId === bursary.id);
      if (existing) {
        toast({
          title: 'Already tracked',
          description: `${bursary.name} is already in your application tracker.`,
        });
        return;
      }

      await addApplication({
        bursaryId: bursary.id,
        deadlineDate: bursary.deadline,
      });

      toast({
        title: 'Added to tracker',
        description: `${bursary.name} is now in your application tracker.`,
      });
    } catch (error) {
      toast({
        title: 'Could not track application',
        description: 'Please try again.',
        variant: 'destructive',
      });
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-700 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-white">
              <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
              <path d="M22 10v6" />
              <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">Loading EduHub SA...</p>
        </div>
      </div>
    );
  }

  // Show profile setup for new users
  if (showProfileSetup && user && profile) {
    return (
      <ProfileSetup
        profile={profile}
        onSave={updateProfile}
        signupPersonaContext={signupPersonaContext}
        onSaveSignupPersona={updateSignupPersonaContext}
        onComplete={handleProfileComplete}
      />
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        if (user && profile) {
          return (
            <Dashboard
              profile={profile}
              onNavigate={handleNavigate}
              applications={applications}
              upcomingDeadlines={upcomingDeadlines}
              onUpdateApplicationStatus={updateStatus}
              onToggleChecklistItem={toggleChecklistItem}
              onRemoveApplication={removeApplication}
            />
          );
        }
        return (
          <HeroSection
            onNavigate={handleNavigate}
            onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={false}
            searchHistory={searchHistory}
          />
        );

      case 'profile':
        if (user && profile) {
          return (
            <ProfileSetup
              profile={profile}
              onSave={updateProfile}
              onComplete={() => setCurrentView('dashboard')}
            />
          );
        }
        return (
          <HeroSection
            onNavigate={handleNavigate}
            onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={false}
            searchHistory={searchHistory}
          />
        );

      case 'careers':
        return (
          <CareerExplorer
            profile={profile}
            onToggleSave={user ? toggleSavedCareer : undefined}
          />
        );

      case 'bursaries':
        return (
          <BursarySearch
            profile={profile}
            onToggleSave={user ? toggleSavedBursary : undefined}
            onTrackApplication={handleTrackApplication}
            trackedApplicationBursaryIds={trackedBursaryIds}
            onViewDetails={handleOpenBursaryDetail}
          />
        );

      case 'bursary-detail':
        if (!selectedBursaryId) {
          return (
            <HeroSection
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={!!user}
              searchHistory={searchHistory}
            />
          );
        }
        return (
          <BursaryDetail
            bursaryId={selectedBursaryId}
            profile={profile}
            onNavigate={handleNavigate}
            onToggleSave={user ? toggleSavedBursary : undefined}
            onTrackApplication={handleTrackApplication}
            trackedApplicationBursaryIds={trackedBursaryIds}
          />
        );

      case 'institutions':
        return (
          <InstitutionFinder
            profile={profile}
            onToggleSave={user ? toggleSavedInstitution : undefined}
          />
        );

      case 'papers':
        return <PastPapers />;

      case 'resources':
        return <ResourceGuides />;

      case 'knowledge':
        return (
          <KnowledgeHub
            onNavigate={handleNavigate}
            onOpenBursaryDetail={handleOpenBursaryDetail}
          />
        );

      case 'cv-builder':
        return (
          <CVBuilder onNavigate={handleNavigate} />
        );

      case 'essay-studio':
        return (
          <EssayStudio onNavigate={handleNavigate} />
        );

      case 'tracker':
        if (!user) {
          return (
            <HeroSection
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={false}
              searchHistory={searchHistory}
            />
          );
        }
        return (
          <ApplicationTracker
            userId={user?.id}
            applications={applications}
            onUpdateApplicationStatus={updateStatus}
            onToggleChecklistItem={toggleChecklistItem}
            onRemoveApplication={removeApplication}
            onUpdateApplicationNotes={updateNotes}
            onImportApplications={importApplications}
            onCreateReminder={createDeadlineReminder}
            reminders={notifications}
            onUpdateReminder={updateReminder}
            onCancelReminder={cancelReminder}
          />
        );

      case 'search':
        return (
          <SearchResults
            query={searchQuery}
            onNavigate={handleNavigate}
            onClear={() => { setSearchQuery(''); setCurrentView('home'); }}
            onSearch={handleSearch}
            onViewBursaryDetail={handleOpenBursaryDetail}
            searchHistory={searchHistory}
            hasUpcomingDeadlines={upcomingDeadlines.length > 0}
            isLoggedIn={!!user}
          />
        );

      case 'admin':
        if (!user || !isAdmin) {
          return (
            <HeroSection
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={false}
              searchHistory={searchHistory}
            />
          );
        }
        return (
          <AdminPanel
            isAdmin={isAdmin}
            applications={applications}
            onImportApplications={importApplications}
            userProfile={profile}
            signupPersonaContext={signupPersonaContext}
          />
        );

      case 'security':
        if (!user) {
          return (
            <HeroSection
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={false}
              searchHistory={searchHistory}
            />
          );
        }
        return (
          <SecuritySettings
            mfaEnabled={mfaEnabled}
            mfaFactors={mfaFactors}
            onRefreshMfaFactors={refreshMfaFactors}
            onEnrollMfaTotp={enrollMfaTotp}
            onVerifyMfaEnrollment={verifyMfaEnrollment}
            onUnenrollMfaFactor={unenrollMfaFactor}
            onNavigate={handleNavigate}
          />
        );

      case 'classroom':
        if (!user) {
          return (
            <HeroSection
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={false}
              searchHistory={searchHistory}
            />
          );
        }
        return (
          <ClassroomMode
            userId={user.id}
            applications={applications}
          />
        );

      case 'premium':
        if (!user || !profile) {
          return (
            <HeroSection
              onNavigate={handleNavigate}
              onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={false}
              searchHistory={searchHistory}
            />
          );
        }
        return (
          <PremiumSettings
            profile={profile}
            onUpdateProfile={updateProfile}
            onNavigate={handleNavigate}
          />
        );

      case 'home':
      default:
        if (user && profile) {
          return (
            <Dashboard
              profile={profile}
              onNavigate={handleNavigate}
              applications={applications}
              upcomingDeadlines={upcomingDeadlines}
              onUpdateApplicationStatus={updateStatus}
              onToggleChecklistItem={toggleChecklistItem}
              onRemoveApplication={removeApplication}
            />
          );
        }
        return (
          <HeroSection
            onNavigate={handleNavigate}
            onSearch={handleSearch}
              onAuthClick={handleAuthClick}
              isLoggedIn={!!user}
            searchHistory={searchHistory}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar
        user={user}
        profile={profile}
        isAdmin={isAdmin}
        onAuthClick={handleAuthClick}
        onSignOut={handleSignOut}
        currentView={currentView}
        onNavigate={handleNavigate}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkNotificationRead={markRead}
        onMarkAllNotificationsRead={markAllRead}
      />

      <PwaStatusBanner />

      {authConfigError ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="mx-auto max-w-7xl text-sm">
            <p className="font-semibold">Authentication is running in browse-only mode.</p>
            <p className="mt-1 text-amber-800">{authConfigError}</p>
          </div>
        </div>
      ) : null}

      <main className="flex-1">
        <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-10 text-gray-600">Loading section...</div>}>
          {renderView()}
        </Suspense>
      </main>

      <Footer onNavigate={handleNavigate} />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuth={{ signUp, signIn, verifyMfa, resetPassword }}
      />

      {showQuickOnboarding && profile ? (
        <ProfileSetupModal
          open={showQuickOnboarding}
          profile={profile}
          onSave={updateProfile}
          signupPersonaContext={signupPersonaContext}
          onSaveSignupPersona={updateSignupPersonaContext}
          onComplete={() => {
            setShowQuickOnboarding(false);
            setCurrentView('dashboard');
          }}
        />
      ) : null}

      {/* Professional floating action area for chat and feedback */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 items-end sm:bottom-6 sm:right-8 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-3 items-end">
          <CareerAdvisorChat profile={profile} isLoggedIn={!!user} />
        </div>
      </div>
    </div>
  );
};

export default AppLayout;






