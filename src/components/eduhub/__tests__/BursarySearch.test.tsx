import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BursarySearch from '@/components/eduhub/BursarySearch';

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

describe('BursarySearch', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows loading state', () => {
    mockUseBursaries.mockReturnValue({
      bursaries: [],
      loading: true,
      error: null,
      refresh: vi.fn(),
    });

    render(<BursarySearch profile={null} />);
    expect(screen.getByText('Loading bursaries...')).toBeTruthy();
  });

  it('shows error state and retry action', () => {
    const refresh = vi.fn();
    mockUseBursaries.mockReturnValue({
      bursaries: [],
      loading: false,
      error: new Error('failed'),
      refresh,
    });

    render(<BursarySearch profile={null} />);

    fireEvent.click(screen.getByText('Retry Loading'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('renders trust metadata and apply flow', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    mockUseBursaries.mockReturnValue({
      bursaries: [
        {
          id: 'b1',
          name: 'NSFAS Bursary',
          provider: 'NSFAS',
          field: 'All Fields',
          eligibility: 'SA citizens',
          deadline: '2026-10-01',
          amount: 'Full funding',
          link: '#',
          description: 'Funding support',
          verificationSource: 'scraped',
          lastVerified: '2026-04-14T00:00:00.000Z',
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    const onViewDetails = vi.fn();

    render(<BursarySearch profile={null} onViewDetails={onViewDetails} />);

    expect(screen.getByText(/Source:/)).toBeTruthy();
    expect(screen.getByText(/Last Updated:/)).toBeTruthy();

    fireEvent.click(screen.getByText('More Details'));
    fireEvent.click(screen.getByText('View bursary details'));
    fireEvent.click(screen.getByText('Find Official Application Link'));

    expect(onViewDetails).toHaveBeenCalledWith('b1');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain('google.com/search');

    openSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('shows relevance badges and highlights matched query terms', () => {
    mockUseBursaries.mockReturnValue({
      bursaries: [
        {
          id: 'b1',
          name: 'NSFAS Bursary',
          provider: 'NSFAS',
          field: 'All Fields',
          eligibility: 'SA citizens',
          deadline: '2026-10-01',
          amount: 'Full funding',
          link: '#',
          description: 'Funding support for South African students',
          verificationSource: 'official',
          lastVerified: '2026-04-14T00:00:00.000Z',
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    const { container } = render(<BursarySearch profile={null} initialSearch="nsfas" />);

    expect(screen.getByText('Best match')).toBeTruthy();
    expect(container.querySelector('mark')).not.toBeNull();
  });

  it('filters out closed bursaries when open-only toggle is enabled', () => {
    mockUseBursaries.mockReturnValue({
      bursaries: [
        {
          id: 'open-1',
          name: 'Open Bursary',
          provider: 'Provider A',
          field: 'Engineering',
          eligibility: 'Eligible',
          deadline: '2099-01-01',
          amount: 'R10,000',
          link: '#',
          description: 'Open record',
        },
        {
          id: 'closed-1',
          name: 'Closed Bursary',
          provider: 'Provider B',
          field: 'Engineering',
          eligibility: 'Eligible',
          deadline: '2020-01-01',
          amount: 'R8,000',
          link: '#',
          description: 'Closed record',
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<BursarySearch profile={null} />);

    expect(screen.getByText('Open Bursary')).toBeTruthy();
    expect(screen.getByText('Closed Bursary')).toBeTruthy();
    fireEvent.click(screen.getByText('Filters & Sorting'));
    fireEvent.click(screen.getByLabelText('Show only open opportunities'));
    expect(screen.getByText('Open Bursary')).toBeTruthy();
    expect(screen.queryByText('Closed Bursary')).toBeNull();
  });

  it('filters to only closing-soon bursaries when toggle is enabled', () => {
    mockUseBursaries.mockReturnValue({
      bursaries: [
        {
          id: 'soon-1',
          name: 'Closing Soon Bursary',
          provider: 'Provider Soon',
          field: 'STEM',
          eligibility: 'Eligible',
          deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 'R12,000',
          link: '#',
          description: 'Soon record',
        },
        {
          id: 'later-1',
          name: 'Later Bursary',
          provider: 'Provider Later',
          field: 'STEM',
          eligibility: 'Eligible',
          deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          amount: 'R9,000',
          link: '#',
          description: 'Later record',
        },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<BursarySearch profile={null} />);

    fireEvent.click(screen.getByText('Filters & Sorting'));
    fireEvent.click(screen.getByLabelText('Show only closing soon opportunities'));

    expect(screen.getByText('Closing Soon Bursary')).toBeTruthy();
    expect(screen.queryByText('Later Bursary')).toBeNull();
  });
});
