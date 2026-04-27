import { describe, expect, it } from 'vitest';
import { filterDisplayableBursaries, filterDisplayableInstitutions } from '@/lib/dataQuality';
import type { Bursary, Institution } from '@/data/staticData';

describe('dataQuality', () => {
  it('filters out bursaries without valid source links or freshness', () => {
    const records = filterDisplayableBursaries([
      {
        id: 'valid-1',
        name: 'Verified Bursary',
        provider: 'Provider A',
        field: 'Engineering',
        eligibility: 'Eligible',
        deadline: '2099-01-01',
        amount: 'R10,000',
        link: 'https://example.org/apply',
        description: 'Verified record',
        freshnessScore: 90,
      },
      {
        id: 'invalid-1',
        name: 'Placeholder Bursary',
        provider: 'Provider B',
        field: 'Engineering',
        eligibility: 'Eligible',
        deadline: '2099-01-01',
        amount: 'R8,000',
        link: '#',
        description: 'Placeholder record',
        freshnessScore: 100,
      },
      {
        id: 'invalid-2',
        name: 'Stale Bursary',
        provider: 'Provider C',
        field: 'Engineering',
        eligibility: 'Eligible',
        deadline: '2099-01-01',
        amount: 'R7,000',
        link: 'https://example.org/stale',
        description: 'Stale record',
        freshnessScore: 10,
      },
    ] as Bursary[]);

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('valid-1');
  });

  it('filters out institutions without valid official websites', () => {
    const records = filterDisplayableInstitutions([
      {
        id: 'valid-inst',
        name: 'Verified University',
        type: 'University',
        location: 'Cape Town',
        province: 'Western Cape',
        website: 'https://example.org',
        courses: ['Engineering'],
        image: '',
        description: 'Verified institution',
        rating: 4.5,
      },
      {
        id: 'invalid-inst',
        name: 'Placeholder College',
        type: 'TVET',
        location: 'Somewhere',
        province: 'Gauteng',
        website: '#',
        courses: ['IT'],
        image: '',
        description: 'Placeholder institution',
        rating: 3.2,
      },
    ] as Institution[]);

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('valid-inst');
  });
});
