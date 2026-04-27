import { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDatabase } from '@/contexts/DatabaseProvider';
import type { Application } from '@/infrastructure/database/indexeddb/schema';

interface CreateApplicationInput {
  bursaryId: string;
  deadlineDate?: string;
  notes?: string;
}

type ChecklistKey = 'idCopy' | 'transcript' | 'motivationLetter' | 'references';

const DEFAULT_CHECKLIST = {
  idCopy: false,
  transcript: false,
  motivationLetter: false,
  references: false,
};

function normalizeChecklist(checklist?: Application['checklist']) {
  return {
    idCopy: !!checklist?.idCopy,
    transcript: !!checklist?.transcript,
    motivationLetter: !!checklist?.motivationLetter,
    references: !!checklist?.references,
  };
}

function normalizeDeadlineDate(deadlineDate?: string) {
  if (!deadlineDate) return undefined;

  const parsed = new Date(deadlineDate);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function isActiveStatus(status: Application['status']) {
  return status === 'draft' || status === 'submitted' || status === 'under-review';
}

export function useApplications(userId?: string) {
  const { applicationRepo } = useDatabase();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadApplications = useCallback(async () => {
    if (!userId) {
      setApplications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const records = await applicationRepo.getUserApplications(userId);
      const normalized = (records as Application[]).map((item) => ({
        ...item,
        checklist: normalizeChecklist(item.checklist),
        deadlineDate: normalizeDeadlineDate(item.deadlineDate),
      }));
      setApplications(normalized);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [applicationRepo, userId]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const addApplication = useCallback(
    async ({ bursaryId, deadlineDate, notes }: CreateApplicationInput) => {
      if (!userId) {
        throw new Error('User is required to track applications');
      }

      const existing = applications.find((item) => item.bursaryId === bursaryId);
      if (existing) {
        return existing;
      }

      const now = new Date().toISOString();
      const record: Application = {
        id: uuidv4(),
        userId,
        bursaryId,
        status: 'draft',
        deadlineDate: normalizeDeadlineDate(deadlineDate),
        notes,
        checklist: DEFAULT_CHECKLIST,
        createdAt: now,
        updatedAt: now,
      };

      await applicationRepo.add(record);
      setApplications((prev) => [record, ...prev]);
      return record;
    },
    [applicationRepo, applications, userId]
  );

  const updateStatus = useCallback(
    async (id: string, status: Application['status']) => {
      await applicationRepo.updateStatus(id, status);
      setApplications((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
        )
      );
    },
    [applicationRepo]
  );

  const updateNotes = useCallback(
    async (id: string, notes?: string) => {
      await applicationRepo.update(id, {
        notes,
        updatedAt: new Date().toISOString(),
      });

      setApplications((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, notes, updatedAt: new Date().toISOString() }
            : item
        )
      );
    },
    [applicationRepo]
  );

  const toggleChecklistItem = useCallback(
    async (id: string, key: ChecklistKey) => {
      const existing = applications.find((item) => item.id === id);
      if (!existing) return;

      const nextChecklist = {
        ...normalizeChecklist(existing.checklist),
        [key]: !existing.checklist?.[key],
      };

      await applicationRepo.update(id, { checklist: nextChecklist });
      setApplications((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, checklist: nextChecklist, updatedAt: new Date().toISOString() }
            : item
        )
      );
    },
    [applicationRepo, applications]
  );

  const removeApplication = useCallback(
    async (id: string) => {
      await applicationRepo.delete(id);
      setApplications((prev) => prev.filter((item) => item.id !== id));
    },
    [applicationRepo]
  );

  const importApplications = useCallback(
    async (rows: Partial<Application>[]) => {
      if (!userId) {
        throw new Error('User is required to import applications');
      }

      const now = new Date().toISOString();
      const existingIds = new Set(applications.map((item) => item.id));
      const existingBursaries = new Set(applications.map((item) => item.bursaryId));
      const created: Application[] = [];

      for (const row of rows) {
        if (!row.bursaryId) continue;
        if (row.id && existingIds.has(row.id)) continue;
        if (existingBursaries.has(row.bursaryId)) continue;

        const record: Application = {
          id: row.id || uuidv4(),
          userId,
          bursaryId: row.bursaryId,
          status: row.status || 'draft',
          deadlineDate: normalizeDeadlineDate(row.deadlineDate),
          notes: row.notes,
          checklist: normalizeChecklist(row.checklist),
          documentsSubmitted: row.documentsSubmitted || [],
          createdAt: row.createdAt || now,
          updatedAt: now,
        };

        await applicationRepo.add(record);
        created.push(record);
      }

      if (created.length > 0) {
        setApplications((prev) => [...created, ...prev]);
      }

      return created.length;
    },
    [applicationRepo, applications, userId]
  );

  const trackedBursaryIds = useMemo(
    () => applications.map((item) => item.bursaryId),
    [applications]
  );

  const upcomingDeadlines = useMemo(() => {
    const now = Date.now();
    const limit = now + 30 * 24 * 60 * 60 * 1000;

    return applications
      .filter((item) => !!item.deadlineDate && isActiveStatus(item.status))
      .filter((item) => {
        const deadline = new Date(item.deadlineDate as string).getTime();
        return deadline >= now && deadline <= limit;
      })
      .sort(
        (a, b) =>
          new Date(a.deadlineDate as string).getTime() - new Date(b.deadlineDate as string).getTime()
      );
  }, [applications]);

  return {
    applications,
    loading,
    error,
    trackedBursaryIds,
    upcomingDeadlines,
    addApplication,
    updateStatus,
    updateNotes,
    toggleChecklistItem,
    removeApplication,
    importApplications,
    refresh: loadApplications,
  };
}
