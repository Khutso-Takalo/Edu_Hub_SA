import { useState, useEffect, useCallback } from 'react';
import { useDatabase } from '@/contexts/DatabaseProvider';
import type { Bursary } from '@/data/staticData';
import { filterDisplayableBursaries } from '@/lib/dataQuality';
import { searchBursaries } from '@/lib/intelligentSearch';

interface UseBursariesOptions {
  includeHidden?: boolean;
}

export function useBursaries(options: UseBursariesOptions = {}) {
  const { bursaryRepo } = useDatabase();
  const [bursaries, setBursaries] = useState<Bursary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const includeHidden = options.includeHidden === true;

  const applyVisibility = useCallback((items: Bursary[]) => {
    const displayable = filterDisplayableBursaries(items);
    if (includeHidden) return displayable;
    return displayable.filter((item) => item.freshnessScore !== 0);
  }, [includeHidden]);

  const loadBursaries = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bursaryRepo.getAll();
      setBursaries(applyVisibility(data as Bursary[]));
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [applyVisibility, bursaryRepo]);

  useEffect(() => {
    void loadBursaries();
  }, [loadBursaries]);

  const search = async (query: string) => {
    setLoading(true);
    try {
      const allBursaries = await bursaryRepo.getAll();
      const rankedResults = searchBursaries(allBursaries as Bursary[], query, {
        limit: 50,
        urgency: /deadline|closing|urgent|apply|submit/i.test(query),
      });

      setBursaries(applyVisibility(rankedResults.map((result) => result.item)));
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { bursaries, loading, error, search, refresh: loadBursaries };
}