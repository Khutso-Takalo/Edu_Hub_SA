import 'fake-indexeddb/auto';
import React from 'react';
import { describe, expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { DatabaseProvider } from '@/contexts/DatabaseProvider';
import { useBursaries } from '@/hooks/useBursaries';

describe('useBursaries', () => {
  test('returns seeded bursary data', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DatabaseProvider>{children}</DatabaseProvider>
    );

    const { result } = renderHook(() => useBursaries(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.bursaries.length).toBeGreaterThan(0);
  });
});
