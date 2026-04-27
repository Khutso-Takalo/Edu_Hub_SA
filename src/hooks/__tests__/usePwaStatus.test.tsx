import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePwaStatus } from '@/hooks/usePwaStatus';

describe('usePwaStatus', () => {
  it('tracks online and offline events', async () => {
    const { result } = renderHook(() => usePwaStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOnline).toBe(true);
  });

  it('reacts to pwa update and offline-ready custom events', () => {
    const { result } = renderHook(() => usePwaStatus());

    expect(result.current.offlineReady).toBe(false);
    expect(result.current.updateReady).toBe(false);

    act(() => {
      window.dispatchEvent(new CustomEvent('eduhub:pwa-offline-ready'));
      window.dispatchEvent(new CustomEvent('eduhub:pwa-update-ready'));
    });

    expect(result.current.offlineReady).toBe(true);
    expect(result.current.updateReady).toBe(true);
  });

  it('applies service worker update when updater exists', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    window.__EDUHUB_UPDATE_SW__ = update;

    const { result } = renderHook(() => usePwaStatus());

    const ok = await result.current.applyUpdate();
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalledWith(true);
  });
});
