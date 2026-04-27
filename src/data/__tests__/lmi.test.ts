import { describe, expect, it } from 'vitest';
import { careers } from '@/data/staticData';
import { getLMISignal, getPathwayRecommendations } from '@/data/lmi';

describe('lmi utilities', () => {
  it('returns seeded demand signal for known careers', () => {
    const career = careers.find((item) => item.id === 'c1');
    expect(career).toBeTruthy();

    const signal = getLMISignal(career!);
    expect(signal.careerId).toBe('c1');
    expect(signal.demandScore).toBeGreaterThan(80);
    expect(signal.signal).toBe('Hot');
  });

  it('builds pathway recommendations with readiness and steps', () => {
    const profile = {
      subjects: [
        { name: 'Mathematics', mark: 76 },
        { name: 'Physical Sciences', mark: 74 },
        { name: 'Information Technology', mark: 79 },
      ],
      career_interests: ['Technology & IT'],
      aps_score: 34,
    };

    const pathways = getPathwayRecommendations(careers, profile, 3);
    expect(pathways).toHaveLength(3);
    expect(pathways[0].demand.demandScore).toBeGreaterThan(0);
    expect(pathways[0].readinessScore).toBeGreaterThan(0);
    expect(pathways[0].steps.length).toBeGreaterThan(0);
  });
});
