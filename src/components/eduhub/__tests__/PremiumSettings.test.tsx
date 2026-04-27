import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PremiumSettings from '@/components/eduhub/PremiumSettings';

const toastMock = vi.fn();

vi.mock('@/components/ui/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const baseProfile = {
  id: 'user-1',
  email: 'user@example.com',
  full_name: 'Test Learner',
  grade_level: 'Grade 12',
  subjects: [],
  aps_score: 32,
  career_interests: [],
  province: 'Gauteng',
  saved_bursaries: [],
  saved_institutions: [],
  saved_careers: [],
  profile_completed: true,
};

describe('PremiumSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows free plan state and disabled entitlements', () => {
    render(
      <PremiumSettings
        profile={{ ...baseProfile, isPremium: false }}
        onUpdateProfile={vi.fn().mockResolvedValue(undefined)}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Premium Settings')).toBeTruthy();
    expect(screen.getByText('Free Plan')).toBeTruthy();
    expect(screen.getByText('Activate Premium')).toBeTruthy();

    const disabledBadges = screen.getAllByText('Disabled');
    expect(disabledBadges.length).toBe(3);
  });

  it('toggles premium on and shows success toast', async () => {
    const updateProfile = vi.fn().mockResolvedValue(undefined);

    render(
      <PremiumSettings
        profile={{ ...baseProfile, isPremium: false }}
        onUpdateProfile={updateProfile}
        onNavigate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Activate Premium'));

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith({ isPremium: true });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Premium enabled' })
      );
    });
  });

  it('shows premium active state and opens CV builder navigation', () => {
    const navigate = vi.fn();

    render(
      <PremiumSettings
        profile={{ ...baseProfile, isPremium: true }}
        onUpdateProfile={vi.fn().mockResolvedValue(undefined)}
        onNavigate={navigate}
      />
    );

    expect(screen.getByText('Premium Active')).toBeTruthy();
    expect(screen.getByText('Switch to Free Plan')).toBeTruthy();

    const enabledBadges = screen.getAllByText('Enabled');
    expect(enabledBadges.length).toBe(3);

    fireEvent.click(screen.getByText('Open CV Builder'));
    expect(navigate).toHaveBeenCalledWith('cv-builder');
  });
});
