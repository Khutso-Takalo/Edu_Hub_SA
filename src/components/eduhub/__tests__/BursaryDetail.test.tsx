import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BursaryDetail from '@/components/eduhub/BursaryDetail';

vi.mock('@/hooks/useBursaries', () => ({
  useBursaries: vi.fn(),
}));

vi.mock('@/hooks/useBursaryFlags', () => ({
  useBursaryFlags: vi.fn(() => ({
    submitFlag: vi.fn().mockResolvedValue({ id: 'flag-1' }),
  })),
}));

import { useBursaries } from '@/hooks/useBursaries';

const mockUseBursaries = useBursaries as unknown as ReturnType<typeof vi.fn>;

describe('BursaryDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows match guidance and closing soon warning', () => {
    mockUseBursaries.mockReturnValue({
      bursaries: [
        {
          id: 'b1',
          name: 'Sasol Bursary Programme',
          provider: 'Sasol',
          field: 'STEM',
          eligibility: 'SA citizens',
          deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          amount: 'R120,000/year',
          link: '#',
          description: 'STEM support',
          minAPS: 32,
          verificationSource: 'scraped',
        },
      ],
    });

    render(
      <BursaryDetail
        bursaryId="b1"
        profile={{
          id: 'u1',
          email: 'student@example.com',
          full_name: 'Student Example',
          grade_level: 'Grade 12',
          subjects: [
            { name: 'Mathematics', mark: 78 },
            { name: 'Physical Sciences', mark: 74 },
          ],
          aps_score: 34,
          career_interests: ['Engineering'],
          province: 'Gauteng',
          saved_bursaries: [],
          saved_institutions: [],
          saved_careers: [],
          profile_completed: true,
        }}
        onNavigate={vi.fn()}
      />
    );

    expect(screen.getByText('Sasol Bursary Programme')).toBeTruthy();
    expect(screen.getByText('Closing soon')).toBeTruthy();
    expect(screen.getByText('APS match')).toBeTruthy();
    expect(screen.getByText('Good match')).toBeTruthy();
    expect(screen.getByText('Never pay to apply')).toBeTruthy();
    expect(screen.getByText('Mathematics')).toBeTruthy();
    expect(screen.getByText('Physical Sciences')).toBeTruthy();
  });

  it('supports tracking and opening the official source', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const trackSpy = vi.fn();

    mockUseBursaries.mockReturnValue({
      bursaries: [
        {
          id: 'b2',
          name: 'NSFAS Bursary',
          provider: 'NSFAS',
          field: 'All Fields',
          eligibility: 'SA citizens',
          deadline: '2099-01-01',
          amount: 'Full funding',
          link: 'https://www.nsfas.org.za',
          description: 'Support',
          minAPS: 0,
        },
      ],
    });

    render(
      <BursaryDetail
        bursaryId="b2"
        profile={null}
        onNavigate={vi.fn()}
        onTrackApplication={trackSpy}
        trackedApplicationBursaryIds={[]}
      />
    );

    fireEvent.click(screen.getByText('Track in application planner'));
    fireEvent.click(screen.getByText('Open official source'));

    expect(trackSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'b2' }));
    expect(openSpy).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
  });
});
