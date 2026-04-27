import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminPanel from '@/components/eduhub/AdminPanel';

const refreshBursariesMock = vi.fn();
const refreshInstitutionsMock = vi.fn();
const loadFlagsMock = vi.fn().mockResolvedValue(undefined);
const resolveFlagMock = vi.fn().mockResolvedValue(true);
const deleteFlagMock = vi.fn().mockResolvedValue(true);

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  Tooltip: () => null,
}));

vi.mock('@/hooks/useBursaries', () => ({
  useBursaries: vi.fn(() => ({
    bursaries: [
      {
        id: 'b1',
        name: 'NSFAS Bursary',
        provider: 'NSFAS',
        field: 'All Fields',
        deadline: '2026-12-31',
      },
    ],
    refresh: refreshBursariesMock,
  })),
}));

vi.mock('@/hooks/useInstitutions', () => ({
  useInstitutions: vi.fn(() => ({
    institutions: [{ id: 'i1', name: 'UP' }],
    refresh: refreshInstitutionsMock,
  })),
}));

vi.mock('@/contexts/DatabaseProvider', () => ({
  useDatabase: vi.fn(() => ({
    bursaryRepo: {
      bulkAdd: vi.fn().mockResolvedValue(1),
      add: vi.fn().mockResolvedValue('b2'),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  })),
}));

vi.mock('@/hooks/useDataFreshness', () => ({
  useDataFreshness: vi.fn(() => ({
    lastUpdated: '2026-04-15T00:00:00.000Z',
    refresh: vi.fn(),
  })),
}));

vi.mock('@/hooks/useBursaryFlags', () => ({
  useBursaryFlags: vi.fn(() => ({
    flags: [],
    openFlags: [],
    loadFlags: loadFlagsMock,
    resolveFlag: resolveFlagMock,
    deleteFlag: deleteFlagMock,
  })),
}));

vi.mock('@/hooks/usePwaStatus', () => ({
  usePwaStatus: vi.fn(() => ({
    isOnline: true,
    offlineReady: true,
    updateReady: false,
    canInstall: false,
    applyUpdate: vi.fn().mockResolvedValue(true),
    promptInstall: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('@/infrastructure/database/indexeddb/seed', () => ({
  getSeedAudit: vi.fn().mockResolvedValue({
    seedVersion: '2026-04-15.2',
    lastSeededAt: '2026-04-15T00:00:00.000Z',
    bursaryCount: 1,
    institutionCount: 1,
  }),
}));

vi.mock('@/infrastructure/database/indexeddb/schema', () => ({
  db: {
    meta: {
      get: vi.fn().mockResolvedValue({
        key: 'seedSummary',
        value: '{"source":"admin-import","imported":1}',
      }),
      put: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

describe('AdminPanel', () => {
  class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
  }

  const createObjectURL = vi.fn(() => 'blob:health');
  const revokeObjectURL = vi.fn();
  const anchorClickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
  const writeText = vi.fn().mockResolvedValue(undefined);
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText,
      },
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  afterAll(() => {
    anchorClickSpy.mockRestore();
  });

  it('renders system health checklist with diagnostics', async () => {
    render(
      <AdminPanel
        applications={[]}
        onImportApplications={vi.fn().mockResolvedValue(0)}
      />
    );

    expect(screen.getByText('System Health Checklist')).toBeTruthy();
    expect(screen.getByText('Connectivity')).toBeTruthy();
    expect(screen.getByText('PWA cache')).toBeTruthy();
    expect(screen.getByText('Seed version')).toBeTruthy();
    expect(screen.getByText('Circuit breaker status')).toBeTruthy();
    expect(screen.getByText('Email breaker opens (7d)')).toBeTruthy();
    expect(screen.getByText('Email breaker recoveries (7d)')).toBeTruthy();
    expect(screen.getByText('Email stability score (7d)')).toBeTruthy();
    expect(screen.getByText('SMS stability score (7d)')).toBeTruthy();
    expect(screen.getAllByText(/vs prev 7d:/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Server-side source catalog')).toBeTruthy();
    expect(screen.getByText('Total 7')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('2026-04-15.2')).toBeTruthy();
      expect(screen.getByText('{"source":"admin-import","imported":1}')).toBeTruthy();
    });
  });

  it('exports a health report snapshot', async () => {
    render(
      <AdminPanel
        applications={[]}
        onImportApplications={vi.fn().mockResolvedValue(0)}
      />
    );

    fireEvent.click(screen.getByText('Export health report'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('copies a health report snapshot to clipboard', async () => {
    render(
      <AdminPanel
        applications={[]}
        onImportApplications={vi.fn().mockResolvedValue(0)}
      />
    );

    fireEvent.click(screen.getByText('Copy health JSON'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toContain('"connectivity"');
      expect(writeText.mock.calls[0][0]).toContain('"seedAudit"');
    });
  });
});
