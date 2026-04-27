import 'fake-indexeddb/auto';
import React from 'react';
import { describe, expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { DatabaseProvider } from '@/contexts/DatabaseProvider';
import { useApplications } from '@/hooks/useApplications';

describe('useApplications', () => {
  test('adds and updates tracked application', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider>{children}</DatabaseProvider>
    );

    const { result } = renderHook(() => useApplications('hook-user-1'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    await result.current.addApplication({
      bursaryId: 'b1',
      deadlineDate: '2026-06-01',
    });

    await waitFor(() => expect(result.current.applications.length).toBe(1));

    const id = result.current.applications[0].id;
    await result.current.updateStatus(id, 'submitted');

    await waitFor(() => expect(result.current.applications[0].status).toBe('submitted'));

    await result.current.updateNotes(id, 'Submitted and waiting for transcript upload');
    await waitFor(() =>
      expect(result.current.applications[0].notes).toBe('Submitted and waiting for transcript upload')
    );
  });

  test('normalizes imported checklist/deadline and excludes closed statuses from upcoming', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider>{children}</DatabaseProvider>
    );

    const { result } = renderHook(() => useApplications('hook-user-2'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    const futureOne = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const futureTwo = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const created = await result.current.importApplications([
      {
        id: 'app-1',
        bursaryId: 'b-active',
        status: 'draft',
        deadlineDate: futureOne,
      },
      {
        id: 'app-2',
        bursaryId: 'b-closed',
        status: 'successful',
        deadlineDate: futureTwo,
      },
      {
        id: 'app-3',
        bursaryId: 'b-invalid-date',
        status: 'draft',
        deadlineDate: 'not-a-date',
      },
    ]);

    expect(created).toBe(3);

    await waitFor(() => expect(result.current.applications.length).toBe(3));

    const active = result.current.applications.find((item) => item.id === 'app-1');
    const invalidDate = result.current.applications.find((item) => item.id === 'app-3');

    expect(active?.checklist).toEqual({
      idCopy: false,
      transcript: false,
      motivationLetter: false,
      references: false,
    });
    expect(active?.deadlineDate).toBe(futureOne.slice(0, 10));
    expect(invalidDate?.deadlineDate).toBeUndefined();

    const upcomingIds = result.current.upcomingDeadlines.map((item) => item.id);
    expect(upcomingIds).toContain('app-1');
    expect(upcomingIds).not.toContain('app-2');
    expect(upcomingIds).not.toContain('app-3');
  });
});
