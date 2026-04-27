import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDatabase } from '@/contexts/DatabaseProvider';
import type { Institution } from '@/data/staticData';
import { filterDisplayableInstitutions } from '@/lib/dataQuality';

export function useInstitutions() {
  const { institutionRepo } = useDatabase();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadInstitutions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await institutionRepo.getAll();
      setInstitutions(filterDisplayableInstitutions(data as Institution[]));
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [institutionRepo]);

  useEffect(() => {
    void loadInstitutions();
  }, [loadInstitutions]);

  const provinces = useMemo(
    () => [...new Set(institutions.map((item) => item.province))].sort(),
    [institutions]
  );

  return {
    institutions,
    provinces,
    loading,
    error,
    refresh: loadInstitutions,
  };
}
