import { useState, useEffect } from 'react';
import { useDatabase } from '../contexts/DatabaseProvider';

export function useBursaries() {
  const { bursaryRepo } = useDatabase();
  const [bursaries, setBursaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadBursaries = async () => {
    try {
      setLoading(true);
      const data = await bursaryRepo.getAll();
      setBursaries(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBursaries();
  }, []);

  const search = async (query) => {
    setLoading(true);
    const results = await bursaryRepo.search(query);
    setBursaries(results);
    setLoading(false);
  };

  return { bursaries, loading, error, search, refresh: loadBursaries };
}