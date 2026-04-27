import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EssayStudio from '@/components/eduhub/EssayStudio';
import * as useAuthModule from '@/hooks/useAuth';
import * as useEssaysModule from '@/hooks/useEssays';
import type { UserProfile } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useEssays');
vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

describe('EssayStudio', () => {
  const mockUseAuth = vi.mocked(useAuthModule.useAuth);
  const mockUseEssays = vi.mocked(useEssaysModule.useEssays);

  const profile: UserProfile = {
    id: 'user-1',
    full_name: 'Jane Doe',
    email: 'jane@example.com',
    province: 'Gauteng',
    grade_level: '12',
    subjects: [],
    aps_score: 30,
    career_interests: [],
    saved_bursaries: [],
    saved_institutions: [],
    saved_careers: [],
    profile_completed: true,
  };

  const setUseAuthReturn = (overrides?: Partial<ReturnType<typeof useAuthModule.useAuth>>) => {
    mockUseAuth.mockReturnValue({
      profile,
      ...overrides,
    } as ReturnType<typeof useAuthModule.useAuth>);
  };

  const setUseEssaysReturn = (overrides?: Partial<ReturnType<typeof useEssaysModule.useEssays>>) => {
    mockUseEssays.mockReturnValue({
      drafts: [],
      activeDraft: null,
      loading: false,
      error: null,
      analysis: {
        wordCount: 0,
        sentenceCount: 0,
        avgSentenceLength: 0,
        readabilityScore: 100,
        keywordCoverage: 0,
        hasOpening: false,
        hasClosing: false,
        suggestedImprovements: [],
      },
      setActiveDraft: vi.fn(),
      loadDrafts: vi.fn().mockResolvedValue([]),
      createDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
      updateDraft: vi.fn().mockResolvedValue(null),
      deleteDraft: vi.fn().mockResolvedValue(true),
      ...overrides,
    } as ReturnType<typeof useEssaysModule.useEssays>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setUseAuthReturn();
    setUseEssaysReturn();
  });

  it('shows login gate when no profile exists', () => {
    setUseAuthReturn({ profile: null });

    render(<EssayStudio />);

    expect(screen.getByText(/Please log in to use Essay Studio/i)).toBeTruthy();
  });

  it('creates a new draft from preset', async () => {
    const createDraft = vi.fn().mockResolvedValue({ id: 'draft-2' });
    setUseEssaysReturn({
      createDraft,
    });

    render(<EssayStudio />);

    fireEvent.click(screen.getByText(/Why I deserve this bursary/i));

    await waitFor(() => {
      expect(createDraft).toHaveBeenCalled();
    });
  });
});
