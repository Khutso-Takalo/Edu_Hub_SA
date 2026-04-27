import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import KnowledgeHub from '@/components/eduhub/KnowledgeHub';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/useBursaries', () => ({
  useBursaries: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';
import { useBursaries } from '@/hooks/useBursaries';

const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;
const mockUseBursaries = useBursaries as unknown as ReturnType<typeof vi.fn>;

const completeProfile = {
  id: 'u-1',
  email: 'student@example.com',
  full_name: 'Student Example',
  grade_level: 'Grade 12',
  subjects: [
    { name: 'Mathematics', mark: 75 },
    { name: 'Physical Sciences', mark: 71 },
  ],
  aps_score: 32,
  career_interests: ['Engineering'],
  province: 'Gauteng',
  saved_bursaries: ['saved-1'],
  saved_institutions: [],
  saved_careers: [],
  profile_completed: true,
};

const incompleteProfile = {
  ...completeProfile,
  subjects: [],
  career_interests: [],
  province: '',
  saved_bursaries: [],
  profile_completed: false,
};

const bursaries = [
  {
    id: 'soon-1',
    name: 'Sasol Bursary Programme',
    provider: 'Sasol',
    field: 'STEM',
    eligibility: 'SA citizens',
    deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    amount: 'R120,000/year',
    link: '#',
    description: 'STEM support',
    minAPS: 32,
  },
  {
    id: 'later-1',
    name: 'Old Mutual Bursary',
    provider: 'Old Mutual',
    field: 'Business & Finance',
    eligibility: 'SA citizens',
    deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    amount: 'R75,000/year',
    link: '#',
    description: 'Finance support',
    minAPS: 30,
  },
];

function renderHub(profile = completeProfile, onOpenBursaryDetail = vi.fn()) {
  mockUseAuth.mockReturnValue({
    profile,
    user: { id: 'u-1' },
    loading: false,
  });

  mockUseBursaries.mockReturnValue({
    bursaries,
    loading: false,
    error: null,
    search: vi.fn(),
    refresh: vi.fn(),
  });

  const onNavigate = vi.fn();

  render(<KnowledgeHub onNavigate={onNavigate} onOpenBursaryDetail={onOpenBursaryDetail} />);

  return { onNavigate, onOpenBursaryDetail };
}

describe('KnowledgeHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a dynamic profile-first action when the profile is incomplete', () => {
    renderHub(incompleteProfile);

    expect(screen.getByText('Complete your profile first')).toBeTruthy();
    expect(screen.getByText('Finish profile')).toBeTruthy();
    expect(screen.getByText('1 closing soon')).toBeTruthy();
  });

  it('opens the next bursary when one is closing soon', () => {
    const onOpenBursaryDetail = vi.fn();
    renderHub(completeProfile, onOpenBursaryDetail);

    expect(screen.getByText('Act on 1 bursary closing soon')).toBeTruthy();

    fireEvent.click(screen.getByText('Open next bursary'));

    expect(onOpenBursaryDetail).toHaveBeenCalledWith('soon-1');
  });

  it('filters topic cards by search', async () => {
    renderHub(completeProfile);

    fireEvent.change(screen.getByPlaceholderText('Search tips, documents, or planning habits...'), {
      target: { value: 'volunteer' },
    });

    await waitFor(() => {
      expect(screen.getByText('CV starter thinking')).toBeTruthy();
    });

    expect(screen.queryByText('Document pack')).toBeNull();
  });
});