import { useCallback, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db, type BursaryFlagRecord } from '@/infrastructure/database/indexeddb/schema';

interface SubmitFlagInput {
  bursaryId: string;
  bursaryName: string;
  reason: string;
  details?: string;
  reporterUserId?: string;
}

export const useBursaryFlags = () => {
  const [flags, setFlags] = useState<BursaryFlagRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const rows = await db.bursaryFlags.toArray();
      const ordered = rows.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setFlags(ordered);
      return ordered;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load bursary flags';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const submitFlag = useCallback(async (input: SubmitFlagInput) => {
    try {
      setLoading(true);
      setError(null);
      const row: BursaryFlagRecord = {
        id: uuidv4(),
        bursaryId: input.bursaryId,
        bursaryName: input.bursaryName,
        reason: input.reason,
        details: input.details,
        status: 'open',
        reporterUserId: input.reporterUserId,
        createdAt: new Date().toISOString(),
      };
      await db.bursaryFlags.add(row);
      await loadFlags();
      return row;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit flag';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  const resolveFlag = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const row = await db.bursaryFlags.get(id);
      if (!row) return false;
      await db.bursaryFlags.put({
        ...row,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
      });
      await loadFlags();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve flag';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  const deleteFlag = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      await db.bursaryFlags.delete(id);
      await loadFlags();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete flag';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadFlags]);

  const openFlags = useMemo(() => flags.filter((flag) => flag.status === 'open'), [flags]);

  return {
    flags,
    openFlags,
    loading,
    error,
    loadFlags,
    submitFlag,
    resolveFlag,
    deleteFlag,
  };
};
