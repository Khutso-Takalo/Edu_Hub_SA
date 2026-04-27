import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CareerExplorer from '@/components/eduhub/CareerExplorer';

vi.mock('@/data/staticData', async () => {
  const actual = await vi.importActual<typeof import('@/data/staticData')>('@/data/staticData');
  return {
    ...actual,
    careers: [
      {
        id: 'valid-career',
        name: 'Software Developer',
        field: 'Technology & IT',
        description: 'Build software applications and systems.',
        demandLevel: 'High',
        longevityReason: 'Strong demand.',
        requiredSubjects: ['Mathematics'],
        minAPS: 28,
        exampleCourses: ['BSc Computer Science'],
        recommendedInstitutions: ['University of Cape Town'],
        salary: 'R250,000/year',
        interests: ['Technology & IT'],
      },
      {
        id: 'invalid-career',
        name: '',
        field: 'Technology & IT',
        description: '',
        demandLevel: 'High',
        longevityReason: 'Placeholder.',
        requiredSubjects: [],
        minAPS: 0,
        exampleCourses: [],
        recommendedInstitutions: [],
        salary: '',
        interests: [],
      },
    ],
    getCareerRecommendations: vi.fn(() => []),
    CAREER_INTEREST_OPTIONS: actual.CAREER_INTEREST_OPTIONS,
  };
});

vi.mock('@/data/lmi', () => ({
  getLMISignal: vi.fn(() => ({
    careerId: 'valid-career',
    demandScore: 82,
    projectedGrowthPct: 12,
    openingsEstimate: 1200,
    signal: 'Strong',
    source: 'Test',
    lastUpdated: '2026-04-16',
  })),
  getPathwayRecommendations: vi.fn(() => []),
}));

describe('CareerExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows verified careers and excludes incomplete placeholder records', () => {
    render(<CareerExplorer profile={null} />);

    expect(screen.getByText('Software Developer')).toBeTruthy();
    expect(screen.queryByText(/Placeholder/)).toBeNull();
  });
});