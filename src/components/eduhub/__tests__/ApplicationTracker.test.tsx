import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApplicationTracker from '@/components/eduhub/ApplicationTracker';
import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';

vi.mock('@/hooks/useBursaries', () => ({
  useBursaries: vi.fn(),
}));

import { useBursaries } from '@/hooks/useBursaries';

const mockUseBursaries = useBursaries as unknown as ReturnType<typeof vi.fn>;

const baseApplications: Application[] = [
  {
    id: 'app-1',
    userId: 'u-1',
    bursaryId: 'b-1',
    status: 'draft',
    deadlineDate: '2099-01-10',
    checklist: {
      idCopy: false,
      transcript: false,
      motivationLetter: false,
      references: false,
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  {
    id: 'app-2',
    userId: 'u-1',
    bursaryId: 'b-2',
    status: 'submitted',
    deadlineDate: '2099-01-15',
    checklist: {
      idCopy: true,
      transcript: true,
      motivationLetter: false,
      references: false,
    },
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
];

const baseReminders: NotificationRecord[] = [
  {
    id: 'rem-1',
    userId: 'u-1',
    title: 'Application reminder',
    message: 'Reminder set for testing',
    channel: 'in-app',
    type: 'deadline-reminder',
    entityId: 'app-1',
    dueDate: '2099-01-05',
    createdAt: '2026-04-10T00:00:00.000Z',
    read: false,
  },
];

function renderTracker(overrides?: {
  applications?: Application[];
  reminders?: NotificationRecord[];
}) {
  const onUpdateApplicationStatus = vi.fn().mockResolvedValue(undefined);
  const onToggleChecklistItem = vi.fn().mockResolvedValue(undefined);
  const onRemoveApplication = vi.fn().mockResolvedValue(undefined);
  const onUpdateApplicationNotes = vi.fn().mockResolvedValue(undefined);
  const onImportApplications = vi.fn().mockResolvedValue(0);
  const onCreateReminder = vi.fn().mockResolvedValue(undefined);
  const onUpdateReminder = vi.fn().mockResolvedValue(undefined);
  const onCancelReminder = vi.fn().mockResolvedValue(undefined);

  render(
    <ApplicationTracker
      applications={overrides?.applications || baseApplications}
      reminders={overrides?.reminders || baseReminders}
      onUpdateApplicationStatus={onUpdateApplicationStatus}
      onToggleChecklistItem={onToggleChecklistItem}
      onRemoveApplication={onRemoveApplication}
      onUpdateApplicationNotes={onUpdateApplicationNotes}
      onImportApplications={onImportApplications}
      onCreateReminder={onCreateReminder}
      onUpdateReminder={onUpdateReminder}
      onCancelReminder={onCancelReminder}
    />
  );

  return {
    onUpdateApplicationStatus,
    onToggleChecklistItem,
    onRemoveApplication,
    onCreateReminder,
    onUpdateReminder,
    onCancelReminder,
    onImportApplications,
  };
}

describe('ApplicationTracker phase 2.5 interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockUseBursaries.mockReturnValue({
      bursaries: [
        { id: 'b-1', name: 'Bursary Alpha' },
        { id: 'b-2', name: 'Bursary Beta' },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('saves and reapplies a filter preset', () => {
    renderTracker();

    fireEvent.change(screen.getByLabelText('Search tracked applications'), {
      target: { value: 'alpha' },
    });

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'submitted' },
    });

    fireEvent.change(screen.getByLabelText('Filter preset name'), {
      target: { value: 'Submitted Alpha' },
    });

    fireEvent.click(screen.getByText('Save current'));

    fireEvent.change(screen.getByLabelText('Search tracked applications'), {
      target: { value: '' },
    });

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'all' },
    });

    fireEvent.click(screen.getByText('Submitted Alpha'));

    expect((screen.getByLabelText('Search tracked applications') as HTMLInputElement).value).toBe('alpha');
    expect((screen.getByLabelText('Filter by status') as HTMLSelectElement).value).toBe('submitted');
  });

  it('supports undo before bulk delete finalizes', () => {
    vi.useFakeTimers();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { onRemoveApplication } = renderTracker();

    fireEvent.click(screen.getByText('Select visible'));
    fireEvent.click(screen.getByText('Remove selected'));

    expect(screen.getByText(/queued for deletion/i)).toBeTruthy();

    fireEvent.click(screen.getByText('Undo delete'));

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(onRemoveApplication).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('edits and cancels reminder from reminder center', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onUpdateReminder, onCancelReminder } = renderTracker();

    fireEvent.change(screen.getByLabelText('Reminder due date'), {
      target: { value: '2099-01-09' },
    });

    fireEvent.click(screen.getByText('Save date'));

    expect(onUpdateReminder).toHaveBeenCalledWith('rem-1', { dueDate: '2099-01-09' });

    fireEvent.click(screen.getByText('Cancel reminder'));

    expect(onCancelReminder).toHaveBeenCalledWith('rem-1');
    confirmSpy.mockRestore();
  });

  it('does not import when CSV rows are invalid', async () => {
    const { onImportApplications } = renderTracker();

    const input = screen.getByLabelText('Import tracker CSV');
    const invalidCsv = new File([
      'status,deadlineDate,notes\nsubmitted,2099-01-01,missing bursary identity',
    ], 'invalid.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [invalidCsv] } });

    await waitFor(() => {
      expect(onImportApplications).not.toHaveBeenCalled();
    });
  });

  it('imports csv rows with quoted commas and escaped quotes', async () => {
    const { onImportApplications } = renderTracker();

    const input = screen.getByLabelText('Import tracker CSV');
    const complexCsv = new File(
      [
        'applicationId,bursaryName,status,deadlineDate,notes\n' +
          'app-quoted,"Bursary Alpha",submitted,2099-02-01,"Need transcript, ID copy, and ""motivation"" draft"',
      ],
      'quoted.csv',
      { type: 'text/csv' }
    );

    fireEvent.change(input, { target: { files: [complexCsv] } });

    await waitFor(() => {
      expect(onImportApplications).toHaveBeenCalledTimes(1);
    });

    const rows = onImportApplications.mock.calls[0][0] as Array<Partial<Application>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'app-quoted',
      bursaryId: 'b-1',
      status: 'submitted',
      deadlineDate: '2099-02-01',
      notes: 'Need transcript, ID copy, and "motivation" draft',
    });
  });

  it('shows tracker intelligence cards and priority queue', () => {
    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          deadlineDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          checklist: { idCopy: false, transcript: false, motivationLetter: false, references: false },
        },
        {
          ...baseApplications[1],
          deadlineDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          checklist: { idCopy: true, transcript: true, motivationLetter: false, references: false },
        },
      ],
    });

    expect(screen.getByText('Active Applications')).toBeTruthy();
    expect(screen.getByText('Priority Queue')).toBeTruthy();
    expect(screen.getByText('Weekly Planner')).toBeTruthy();
    expect(screen.getByText('Tracker Trends (Last 7 Snapshots)')).toBeTruthy();
    expect(screen.getByText('Execution Forecast')).toBeTruthy();
    expect(screen.getAllByText(/Risk/).length).toBeGreaterThan(0);
    expect(screen.getByText('The rules behind a strong application queue')).toBeTruthy();
  });

  it('queues weekly reminders for upcoming deadlines without active reminders', async () => {
    const nearDeadlineA = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nearDeadlineB = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { onCreateReminder } = renderTracker({
      applications: [
        {
          ...baseApplications[0],
          deadlineDate: nearDeadlineA,
        },
        {
          ...baseApplications[1],
          deadlineDate: nearDeadlineB,
        },
      ],
      reminders: [
        {
          ...baseReminders[0],
          entityId: 'app-1',
          dueDate: nearDeadlineA,
        },
      ],
    });

    fireEvent.click(screen.getByText('Queue weekly reminders'));

    await waitFor(() => {
      expect(onCreateReminder).toHaveBeenCalledTimes(1);
    });

    expect(onCreateReminder).toHaveBeenCalledWith({
      applicationId: 'app-2',
      dueDate: nearDeadlineB,
      title: 'Important: deadline this week',
      message: 'Deadline is approaching for Bursary Beta.',
    });

    expect(screen.getByText('Queued weekly deadline reminders', { selector: 'p' })).toBeTruthy();
  });

  it('shows daily goal tracker and logs goal completion', async () => {
    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          deadlineDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      ],
    });

    expect(screen.getByText('Daily Goal Tracker')).toBeTruthy();
    expect(screen.getByText(/7-day completion/i)).toBeTruthy();

    fireEvent.click(screen.getByText('Log today as complete'));

    await waitFor(() => {
      expect(screen.getByText('Completed today')).toBeTruthy();
    });

    expect(screen.getByText('Logged daily execution goal', { selector: 'p' })).toBeTruthy();
    expect(screen.getByText('Log today as complete')).toHaveProperty('disabled', true);
  });

  it('builds a daily task queue and records complete or skip actions', async () => {
    const heavyApplications: Application[] = Array.from({ length: 8 }, (_, idx) => ({
      ...baseApplications[0],
      id: `app-heavy-${idx + 1}`,
      bursaryId: idx % 2 === 0 ? 'b-1' : 'b-2',
      deadlineDate: new Date(Date.now() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      checklist: {
        idCopy: idx % 2 === 0,
        transcript: false,
        motivationLetter: false,
        references: false,
      },
    }));

    renderTracker({ applications: heavyApplications, reminders: [] });

    expect(screen.getByText('Daily Task Queue')).toBeTruthy();
    expect(screen.getAllByText('Complete task').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Skip task').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Complete task')[0]);
    await waitFor(() => {
      expect(screen.getByText('Completed daily queue task', { selector: 'p' })).toBeTruthy();
    });

    fireEvent.click(screen.getAllByText('Skip task')[0]);
    await waitFor(() => {
      expect(screen.getByText('Skipped daily queue task', { selector: 'p' })).toBeTruthy();
    });
  });

  it('adapts daily target upward when recent completion is strong', () => {
    const strongHistory = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(Date.now() - idx * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return { date, completed: 1, target: 1 };
    });
    localStorage.setItem('eduhub:tracker-goal-history:v1', JSON.stringify(strongHistory));

    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          deadlineDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      ],
      reminders: [],
    });

    expect(screen.getByText('Adaptive target: 2 tasks (base 1).')).toBeTruthy();
  });

  it('carries skipped tasks from yesterday into today queue', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    localStorage.setItem(
      'eduhub:tracker-daily-task-queue:v1',
      JSON.stringify({
        [yesterday]: [
          {
            id: 'app-old:docs',
            applicationId: 'app-1',
            bursaryName: 'Bursary Alpha',
            label: 'Prepare transcript and references',
            status: 'skipped',
            priorityScore: 100,
            carryOver: false,
          },
        ],
      })
    );

    renderTracker({ applications: [], reminders: [] });

    expect(screen.getByText('Daily Task Queue')).toBeTruthy();
    expect(screen.getByText('Carry-over: Prepare transcript and references')).toBeTruthy();
    expect(screen.getByText('Pending', { selector: 'span' })).toBeTruthy();
    expect(screen.getByText('Carry-over backlog')).toBeTruthy();
  });

  it('exports and imports execution history', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(() => 'blob:history-url');
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          deadlineDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      ],
      reminders: [],
    });

    fireEvent.click(screen.getByText('Export history'));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);

    const todayDate = new Date().toISOString().slice(0, 10);
    const importPayload = {
      goalHistory: [{ date: todayDate, completed: 2, target: 2 }],
      dailyTaskQueueByDate: {
        [todayDate]: [
          {
            id: 'task-1',
            applicationId: 'app-1',
            bursaryName: 'Bursary Alpha',
            label: 'Carry-over: Review checklist',
            status: 'skipped',
            priorityScore: 100,
            carryOver: true,
          },
        ],
      },
    };
    const historyInput = screen.getByLabelText('Import execution history');
    const historyFile = new File([JSON.stringify(importPayload)], 'history.json', { type: 'application/json' });

    fireEvent.change(historyInput, { target: { files: [historyFile] } });

    await waitFor(() => {
      expect(screen.getByText('Carry-over: Review checklist')).toBeTruthy();
    });

    expect(screen.getByText('Log today as complete')).toHaveProperty('disabled', true);

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
    clickSpy.mockRestore();
  });

  it('reorders today queue manually and persists the new order', () => {
    const todayDate = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      'eduhub:tracker-daily-task-queue:v1',
      JSON.stringify({
        [todayDate]: [
          {
            id: 'task-a',
            applicationId: 'app-1',
            bursaryName: 'Bursary Alpha',
            label: 'Prepare transcript',
            status: 'pending',
            priorityScore: 80,
            carryOver: false,
          },
          {
            id: 'task-b',
            applicationId: 'app-2',
            bursaryName: 'Bursary Beta',
            label: 'Submit application',
            status: 'pending',
            priorityScore: 60,
            carryOver: false,
          },
        ],
      })
    );

    renderTracker({ applications: [], reminders: [] });

    const initialQueueItems = screen.getAllByTestId('daily-task-queue-item');
    expect(initialQueueItems.length).toBeGreaterThan(1);

    const firstTextBefore = initialQueueItems[0].textContent || '';
    const secondTextBefore = initialQueueItems[1].textContent || '';

    fireEvent.click(within(initialQueueItems[0]).getByText('Move down'));

    const reorderedQueueItems = screen.getAllByTestId('daily-task-queue-item');
    expect(reorderedQueueItems[0].textContent).toBe(secondTextBefore);
    expect(reorderedQueueItems[1].textContent).toBe(firstTextBefore);

    cleanup();
    renderTracker({ applications: [], reminders: [] });

    const persistedQueueItems = screen.getAllByTestId('daily-task-queue-item');
    expect(persistedQueueItems[0].textContent).toBe(secondTextBefore);
    expect(persistedQueueItems[1].textContent).toBe(firstTextBefore);
  });

  it('dismisses skipped backlog older than 7 days', async () => {
    const todayDate = new Date().toISOString().slice(0, 10);
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    localStorage.setItem(
      'eduhub:tracker-daily-task-queue:v1',
      JSON.stringify({
        [todayDate]: [
          {
            id: 'task-today',
            applicationId: 'app-1',
            bursaryName: 'Bursary Alpha',
            label: 'Keep today item',
            status: 'pending',
            priorityScore: 80,
            carryOver: false,
          },
        ],
        [oldDate]: [
          {
            id: 'task-old',
            applicationId: 'app-1',
            bursaryName: 'Bursary Alpha',
            label: 'Old skipped task',
            status: 'skipped',
            priorityScore: 20,
            carryOver: true,
          },
        ],
        [recentDate]: [
          {
            id: 'task-recent',
            applicationId: 'app-2',
            bursaryName: 'Bursary Beta',
            label: 'Recent skipped task',
            status: 'skipped',
            priorityScore: 40,
            carryOver: true,
          },
        ],
      })
    );
    localStorage.setItem('eduhub:tracker-dismissed-backlog-archive:v1', '[]');

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker({ applications: [], reminders: [] });

    expect(screen.getByText('Old skipped items older than 7 days: 1')).toBeTruthy();
    expect(screen.getByText('Dismiss old skipped')).toBeTruthy();

    fireEvent.click(screen.getByText('Dismiss old skipped'));

    expect(screen.queryByText('Old skipped items older than 7 days: 1')).toBeNull();
    expect(screen.getByText('2-3 days old: 1')).toBeTruthy();
    await waitFor(() => {
      const archived = JSON.parse(
        localStorage.getItem('eduhub:tracker-dismissed-backlog-archive:v1') || '[]'
      ) as Array<{ items: Array<{ label: string }> }>;
      expect(archived).toHaveLength(1);
      expect(archived[0].items[0].label).toBe('Old skipped task');
    });

    cleanup();
    renderTracker({ applications: [], reminders: [] });

    expect(screen.getByText('Dismissed backlog archive')).toBeTruthy();
    expect(screen.getByText(/Old skipped task/)).toBeTruthy();

    confirmSpy.mockRestore();
  });

  it('restores an archived backlog entry into today queue', async () => {
    const todayDate = new Date().toISOString().slice(0, 10);
    localStorage.setItem('eduhub:tracker-daily-task-queue:v1', JSON.stringify({ [todayDate]: [] }));
    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-1',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-01',
          items: [
            {
              id: 'task-archived-1',
              applicationId: 'app-1',
              bursaryName: 'Bursary Alpha',
              label: 'Archived skipped task',
              status: 'skipped',
              priorityScore: 30,
              carryOver: true,
            },
          ],
        },
      ])
    );

    renderTracker({ applications: [], reminders: [] });

    expect(screen.getByText('Dismissed backlog archive')).toBeTruthy();
    fireEvent.click(screen.getByText('Restore to queue'));

    await waitFor(() => {
      expect(screen.queryByText('Dismissed backlog archive')).toBeNull();
      expect(screen.getByText('Archived skipped task')).toBeTruthy();
      expect(screen.getByText('Pending', { selector: 'span' })).toBeTruthy();
    });
  });

  it('clears dismissed backlog archive entries', async () => {
    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-clear-1',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-01',
          items: [
            {
              id: 'task-archive-clear-1',
              applicationId: 'app-1',
              bursaryName: 'Bursary Alpha',
              label: 'Old skipped task to clear',
              status: 'skipped',
              priorityScore: 10,
              carryOver: true,
            },
          ],
        },
      ])
    );

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderTracker({ applications: [], reminders: [] });

    expect(screen.getByText('Dismissed backlog archive')).toBeTruthy();
    fireEvent.click(screen.getByText('Clear archive'));

    await waitFor(() => {
      expect(screen.queryByText('Dismissed backlog archive')).toBeNull();
      const archived = JSON.parse(
        localStorage.getItem('eduhub:tracker-dismissed-backlog-archive:v1') || '[]'
      ) as Array<unknown>;
      expect(archived).toHaveLength(0);
    });

    confirmSpy.mockRestore();
  });

  it('restores selected archive entries in bulk', async () => {
    const todayDate = new Date().toISOString().slice(0, 10);
    localStorage.setItem('eduhub:tracker-daily-task-queue:v1', JSON.stringify({ [todayDate]: [] }));
    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-bulk-1',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-01',
          items: [
            {
              id: 'task-bulk-1',
              applicationId: 'app-1',
              bursaryName: 'Bursary Alpha',
              label: 'Bulk restore task one',
              status: 'skipped',
              priorityScore: 20,
              carryOver: true,
            },
          ],
        },
        {
          id: 'archive-bulk-2',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-02',
          items: [
            {
              id: 'task-bulk-2',
              applicationId: 'app-2',
              bursaryName: 'Bursary Beta',
              label: 'Bulk restore task two',
              status: 'skipped',
              priorityScore: 25,
              carryOver: true,
            },
          ],
        },
      ])
    );

    renderTracker({ applications: [], reminders: [] });

    const checkboxes = screen.getAllByRole('checkbox', { name: /Select archive entry/i });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByText('Restore selected'));

    await waitFor(() => {
      expect(screen.queryByText('Dismissed backlog archive')).toBeNull();
      expect(screen.getByText('Bulk restore task one')).toBeTruthy();
      expect(screen.getByText('Bulk restore task two')).toBeTruthy();
    });
  });

  it('removes selected archive entries in bulk', async () => {
    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-remove-1',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-01',
          items: [
            {
              id: 'task-remove-1',
              applicationId: 'app-1',
              bursaryName: 'Bursary Alpha',
              label: 'Bulk remove task one',
              status: 'skipped',
              priorityScore: 20,
              carryOver: true,
            },
          ],
        },
        {
          id: 'archive-remove-2',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-02',
          items: [
            {
              id: 'task-remove-2',
              applicationId: 'app-2',
              bursaryName: 'Bursary Beta',
              label: 'Bulk remove task two',
              status: 'skipped',
              priorityScore: 25,
              carryOver: true,
            },
          ],
        },
      ])
    );

    renderTracker({ applications: [], reminders: [] });

    fireEvent.click(screen.getByLabelText('Toggle visible archive selection'));
    fireEvent.click(screen.getByLabelText('Remove selected archive entries'));

    await waitFor(() => {
      expect(screen.queryByText('Dismissed backlog archive')).toBeNull();
      const archived = JSON.parse(
        localStorage.getItem('eduhub:tracker-dismissed-backlog-archive:v1') || '[]'
      ) as Array<unknown>;
      expect(archived).toHaveLength(0);
    });
  });

  it('paginates dismissed backlog archive entries', async () => {
    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-page-1',
          dismissedAt: '2026-04-01T08:00:00.000Z',
          sourceDate: '2026-04-01',
          items: [{
            id: 'task-page-1',
            applicationId: 'app-1',
            bursaryName: 'Bursary Alpha',
            label: 'Archive page task one',
            status: 'skipped',
            priorityScore: 20,
            carryOver: true,
          }],
        },
        {
          id: 'archive-page-2',
          dismissedAt: '2026-04-02T08:00:00.000Z',
          sourceDate: '2026-04-02',
          items: [{
            id: 'task-page-2',
            applicationId: 'app-2',
            bursaryName: 'Bursary Beta',
            label: 'Archive page task two',
            status: 'skipped',
            priorityScore: 21,
            carryOver: true,
          }],
        },
        {
          id: 'archive-page-3',
          dismissedAt: '2026-04-03T08:00:00.000Z',
          sourceDate: '2026-04-03',
          items: [{
            id: 'task-page-3',
            applicationId: 'app-1',
            bursaryName: 'Bursary Alpha',
            label: 'Archive page task three',
            status: 'skipped',
            priorityScore: 22,
            carryOver: true,
          }],
        },
        {
          id: 'archive-page-4',
          dismissedAt: '2026-04-04T08:00:00.000Z',
          sourceDate: '2026-04-04',
          items: [{
            id: 'task-page-4',
            applicationId: 'app-2',
            bursaryName: 'Bursary Beta',
            label: 'Archive page task four',
            status: 'skipped',
            priorityScore: 23,
            carryOver: true,
          }],
        },
      ])
    );

    renderTracker({ applications: [], reminders: [] });

    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    expect(screen.getByText(/Archive page task four/)).toBeTruthy();
    expect(screen.queryByText(/Archive page task one/)).toBeNull();

    fireEvent.click(screen.getByLabelText('Next archive page'));

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 2')).toBeTruthy();
      expect(screen.getByText(/Archive page task one/)).toBeTruthy();
      expect(screen.queryByText(/Archive page task four/)).toBeNull();
    });
  });

  it('filters dismissed backlog archive by task text and source date', async () => {
    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-filter-1',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-10',
          items: [
            {
              id: 'task-filter-1',
              applicationId: 'app-1',
              bursaryName: 'Bursary Alpha',
              label: 'Targeted archive task',
              status: 'skipped',
              priorityScore: 20,
              carryOver: true,
            },
          ],
        },
        {
          id: 'archive-filter-2',
          dismissedAt: new Date().toISOString(),
          sourceDate: '2026-04-11',
          items: [
            {
              id: 'task-filter-2',
              applicationId: 'app-2',
              bursaryName: 'Bursary Beta',
              label: 'Another archive task',
              status: 'skipped',
              priorityScore: 21,
              carryOver: true,
            },
          ],
        },
      ])
    );

    renderTracker({ applications: [], reminders: [] });

    fireEvent.change(screen.getByLabelText('Archive search'), {
      target: { value: 'Targeted' },
    });

    await waitFor(() => {
      expect(screen.getByText(/Targeted archive task/)).toBeTruthy();
      expect(screen.queryByText(/Another archive task/)).toBeNull();
    });

    fireEvent.change(screen.getByLabelText('Archive search'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Archive source date'), {
      target: { value: '2026-04-11' },
    });

    await waitFor(() => {
      expect(screen.getByText(/Another archive task/)).toBeTruthy();
      expect(screen.queryByText(/Targeted archive task/)).toBeNull();
    });
  });

  it('sorts dismissed backlog archive entries', async () => {
    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-sort-1',
          dismissedAt: '2026-04-12T10:00:00.000Z',
          sourceDate: '2026-04-10',
          items: [
            {
              id: 'task-sort-1',
              applicationId: 'app-1',
              bursaryName: 'Bursary Alpha',
              label: 'Sort task newer',
              status: 'skipped',
              priorityScore: 30,
              carryOver: true,
            },
          ],
        },
        {
          id: 'archive-sort-2',
          dismissedAt: '2026-04-11T10:00:00.000Z',
          sourceDate: '2026-04-05',
          items: [
            {
              id: 'task-sort-2',
              applicationId: 'app-2',
              bursaryName: 'Bursary Beta',
              label: 'Sort task older',
              status: 'skipped',
              priorityScore: 31,
              carryOver: true,
            },
          ],
        },
      ])
    );

    renderTracker({ applications: [], reminders: [] });

    const initialEntries = screen.getAllByTestId('archive-entry');
    expect(initialEntries[0].textContent).toContain('Sort task newer');

    fireEvent.change(screen.getByLabelText('Archive sort'), {
      target: { value: 'source-asc' },
    });

    await waitFor(() => {
      const sortedEntries = screen.getAllByTestId('archive-entry');
      expect(sortedEntries[0].textContent).toContain('Sort task older');
    });
  });

  it('shows archive analytics and updates with quick date presets', async () => {
    const now = Date.now();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString();

    localStorage.setItem(
      'eduhub:tracker-dismissed-backlog-archive:v1',
      JSON.stringify([
        {
          id: 'archive-analytics-recent',
          dismissedAt: twoDaysAgo,
          sourceDate: new Date(twoDaysAgo).toISOString().slice(0, 10),
          items: [
            {
              id: 'task-analytics-1',
              applicationId: 'app-1',
              bursaryName: 'Bursary Alpha',
              label: 'Analytics recent task',
              status: 'skipped',
              priorityScore: 10,
              carryOver: true,
            },
          ],
        },
        {
          id: 'archive-analytics-old',
          dismissedAt: fortyDaysAgo,
          sourceDate: new Date(fortyDaysAgo).toISOString().slice(0, 10),
          items: [
            {
              id: 'task-analytics-2',
              applicationId: 'app-2',
              bursaryName: 'Bursary Beta',
              label: 'Analytics old task',
              status: 'skipped',
              priorityScore: 11,
              carryOver: true,
            },
          ],
        },
      ])
    );

    localStorage.setItem(
      'eduhub:tracker-automation-audit:v1',
      JSON.stringify([
        {
          id: 'audit-recent-restore',
          timestamp: twoDaysAgo,
          action: 'Restored dismissed backlog entries',
          targetLabel: '2 entries',
          reason: 'test',
        },
        {
          id: 'audit-old-remove',
          timestamp: fortyDaysAgo,
          action: 'Removed dismissed backlog archive entries',
          targetLabel: '3 entries',
          reason: 'test',
        },
      ])
    );

    renderTracker({ applications: [], reminders: [] });

    expect(screen.getByText('Dismissed entries')).toBeTruthy();
    expect(screen.getByText('Restored')).toBeTruthy();
    expect(screen.getByText('Removed')).toBeTruthy();
    expect(screen.getByTestId('archive-analytics-dismissed').textContent).toBe('1');
    expect(screen.getByTestId('archive-analytics-restored').textContent).toBe('2');
    expect(screen.getByTestId('archive-analytics-removed').textContent).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: 'All time' }));

    await waitFor(() => {
      expect(screen.getByTestId('archive-analytics-dismissed').textContent).toBe('2');
      expect(screen.getByTestId('archive-analytics-removed').textContent).toBe('3');
    });
  });

  it('filters daily task queue by status', () => {
    const heavyApplications: Application[] = Array.from({ length: 6 }, (_, idx) => ({
      ...baseApplications[0],
      id: `app-filter-${idx + 1}`,
      bursaryId: idx % 2 === 0 ? 'b-1' : 'b-2',
      deadlineDate: new Date(Date.now() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      checklist: {
        idCopy: idx % 2 === 0,
        transcript: false,
        motivationLetter: false,
        references: false,
      },
    }));

    renderTracker({ applications: heavyApplications, reminders: [] });

    expect(screen.getByText('Daily Task Queue')).toBeTruthy();

    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByText('Complete task')).toBeNull();
    expect(screen.getByText('Daily Task Queue')).toBeTruthy();

    fireEvent.click(screen.getByText('Pending'));
    expect(screen.getAllByText('Complete task').length).toBeGreaterThan(0);
  });

  it('auto-completes the daily goal when queue work reaches target', async () => {
    const strongHistory = Array.from({ length: 7 }, (_, idx) => {
      const date = new Date(Date.now() - idx * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return { date, completed: 1, target: 1 };
    });
    localStorage.setItem('eduhub:tracker-goal-history:v1', JSON.stringify(strongHistory));

    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          deadlineDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          checklist: { idCopy: false, transcript: false, motivationLetter: false, references: false },
        },
        {
          ...baseApplications[1],
          deadlineDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          checklist: { idCopy: false, transcript: false, motivationLetter: false, references: false },
        },
      ],
      reminders: [],
    });

    fireEvent.click(screen.getAllByText('Complete task')[0]);

    await waitFor(() => {
      expect(screen.getByText('Completed today')).toBeTruthy();
    });
  });

  it('focuses a risky application when resolve now is clicked', () => {
    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          deadlineDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          checklist: { idCopy: false, transcript: false, motivationLetter: false, references: false },
        },
      ],
    });

    fireEvent.click(screen.getByText('Resolve now'));

    expect((screen.getByLabelText('Search tracked applications') as HTMLInputElement).value).toBe('Bursary Alpha');
  });

  it('marks missing docs complete with one click', async () => {
    const { onToggleChecklistItem } = renderTracker({
      applications: [
        {
          ...baseApplications[0],
          checklist: { idCopy: false, transcript: true, motivationLetter: false, references: false },
        },
      ],
    });

    fireEvent.click(screen.getAllByText('Complete missing docs')[0]);

    await waitFor(() => {
      expect(onToggleChecklistItem).toHaveBeenCalledWith('app-1', 'idCopy');
      expect(onToggleChecklistItem).toHaveBeenCalledWith('app-1', 'motivationLetter');
      expect(onToggleChecklistItem).toHaveBeenCalledWith('app-1', 'references');
    });
  });

  it('applies suggested status automation when checklist is complete', async () => {
    const { onUpdateApplicationStatus } = renderTracker({
      applications: [
        {
          ...baseApplications[0],
          status: 'draft',
          checklist: { idCopy: true, transcript: true, motivationLetter: true, references: true },
        },
      ],
    });

    fireEvent.click(screen.getByText('Mark as submitted'));

    await waitFor(() => {
      expect(onUpdateApplicationStatus).toHaveBeenCalledWith('app-1', 'submitted');
    });
  });

  it('hides automation actions in manual mode', () => {
    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          status: 'draft',
          checklist: { idCopy: true, transcript: true, motivationLetter: true, references: true },
        },
      ],
    });

    expect(screen.getByText('Complete missing docs')).toBeTruthy();
    expect(screen.getByText('Mark as submitted')).toBeTruthy();

    fireEvent.click(screen.getByText('Manual'));

    expect(screen.queryByText('Complete missing docs')).toBeNull();
    expect(screen.queryByText('Mark as submitted')).toBeNull();
    expect(screen.queryByText('Queue weekly reminders')).toBeNull();
  });

  it('shows reminder severity badge', () => {
    renderTracker();
    expect(screen.getByText('Medium')).toBeTruthy();
  });

  it('suggests move to under-review when submitted reminder is aging', async () => {
    const { onUpdateApplicationStatus } = renderTracker({
      applications: [
        {
          ...baseApplications[0],
          status: 'submitted',
          checklist: { idCopy: true, transcript: true, motivationLetter: true, references: true },
        },
      ],
      reminders: [
        {
          ...baseReminders[0],
          entityId: 'app-1',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });

    fireEvent.click(screen.getByText('Mark as under review'));

    await waitFor(() => {
      expect(onUpdateApplicationStatus).toHaveBeenCalledWith('app-1', 'under-review');
    });
  });

  it('snoozes reminder by 3 days', async () => {
    const { onUpdateReminder } = renderTracker({
      reminders: [
        {
          ...baseReminders[0],
          dueDate: '2099-01-05',
        },
      ],
    });

    fireEvent.click(screen.getByText('Snooze 3d'));

    await waitFor(() => {
      expect(onUpdateReminder).toHaveBeenCalledWith('rem-1', { dueDate: '2099-01-08' });
    });
  });

  it('records automation actions in audit log', async () => {
    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          checklist: { idCopy: false, transcript: true, motivationLetter: false, references: false },
        },
      ],
    });

    fireEvent.click(screen.getAllByText('Complete missing docs')[0]);

    await waitFor(() => {
      expect(screen.getByText('Automation Audit Log')).toBeTruthy();
      expect(screen.getByText('Completed missing checklist documents', { selector: 'p' })).toBeTruthy();
    });
  });

  it('filters automation audit log by action', async () => {
    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          checklist: { idCopy: false, transcript: true, motivationLetter: false, references: false },
        },
      ],
      reminders: [
        {
          ...baseReminders[0],
          dueDate: '2099-01-05',
        },
      ],
    });

    fireEvent.click(screen.getAllByText('Complete missing docs')[0]);
    await waitFor(() => {
      expect(screen.getByText('Completed missing checklist documents', { selector: 'p' })).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Snooze 1d'));
    await waitFor(() => {
      expect(screen.getByText('Snoozed reminder', { selector: 'p' })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Audit action filter'), {
      target: { value: 'Snoozed reminder' },
    });

    expect(screen.getByText('Snoozed reminder', { selector: 'p' })).toBeTruthy();
    expect(screen.queryByText('Completed missing checklist documents', { selector: 'p' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Audit search'), {
      target: { value: 'Shifted due date' },
    });

    expect(screen.getByText('Snoozed reminder', { selector: 'p' })).toBeTruthy();
  });

  it('exports filtered audit log csv', async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    const createObjectURLMock = vi.fn(() => 'blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderTracker({
      applications: [
        {
          ...baseApplications[0],
          checklist: { idCopy: false, transcript: true, motivationLetter: false, references: false },
        },
      ],
    });

    fireEvent.click(screen.getAllByText('Complete missing docs')[0]);
    await waitFor(() => {
      expect(screen.getByText('Completed missing checklist documents', { selector: 'p' })).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Export audit CSV'));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
    clickSpy.mockRestore();
  });

  it('paginates audit log entries and clears with backup export', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(() => 'blob:backup-url');
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderTracker();

    fireEvent.click(screen.getAllByText('Complete missing docs')[0]);
    await waitFor(() => {
      expect(screen.getByText('Completed missing checklist documents', { selector: 'p' })).toBeTruthy();
    });

    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(screen.getAllByText('Snooze 1d')[0]);
    }

    await waitFor(() => {
      expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    });

    const nextButton = screen
      .getAllByText('Next')
      .find((button) => !(button as HTMLButtonElement).disabled);
    expect(nextButton).toBeTruthy();
    fireEvent.click(nextButton as HTMLElement);
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();

    fireEvent.click(screen.getByText('Clear audit log'));

    await waitFor(() => {
      expect(screen.getByText('No automation actions recorded yet.')).toBeTruthy();
    });

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalled();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: originalRevokeObjectURL,
    });
    clickSpy.mockRestore();
    confirmSpy.mockRestore();
  });
});
