import { useCallback, useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

type SWUpdater = (reloadPage?: boolean) => Promise<void>;

declare global {
  interface Window {
    __EDUHUB_UPDATE_SW__?: SWUpdater;
  }
}

export function usePwaStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onOfflineReady = () => setOfflineReady(true);
    const onUpdateReady = () => setUpdateReady(true);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('eduhub:pwa-offline-ready', onOfflineReady);
    window.addEventListener('eduhub:pwa-update-ready', onUpdateReady);
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('eduhub:pwa-offline-ready', onOfflineReady);
      window.removeEventListener('eduhub:pwa-update-ready', onUpdateReady);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!window.__EDUHUB_UPDATE_SW__) {
      setUpdateReady(false);
      return false;
    }

    await window.__EDUHUB_UPDATE_SW__(true);
    setUpdateReady(false);
    return true;
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredInstallPrompt) return false;

    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
    return true;
  }, [deferredInstallPrompt]);

  const state = useMemo(
    () => ({
      isOnline,
      offlineReady,
      updateReady,
      canInstall: !!deferredInstallPrompt,
    }),
    [deferredInstallPrompt, isOnline, offlineReady, updateReady]
  );

  return {
    ...state,
    applyUpdate,
    promptInstall,
  };
}
