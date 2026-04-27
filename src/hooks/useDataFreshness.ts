import { useEffect, useState } from 'react';
import { db } from '@/infrastructure/database/indexeddb/schema';

export function useDataFreshness() {
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = async () => {
    const record = await db.meta.get('lastSeededAt');
    setLastUpdated(record?.value || null);
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { lastUpdated, refresh };
}
