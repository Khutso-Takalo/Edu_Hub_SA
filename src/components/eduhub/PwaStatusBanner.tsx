import React from 'react';
import { CloudOff, Download, RefreshCcw, Wifi } from 'lucide-react';
import { usePwaStatus } from '@/hooks/usePwaStatus';

const PwaStatusBanner: React.FC = () => {
  const { isOnline, offlineReady, updateReady, canInstall, applyUpdate, promptInstall } = usePwaStatus();

  if (isOnline && !offlineReady && !updateReady && !canInstall) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 bg-slate-900 text-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {isOnline ? <Wifi className="w-4 h-4 text-emerald-300" /> : <CloudOff className="w-4 h-4 text-amber-300" />}
          {!isOnline ? 'Offline mode active. You can keep working with local data.' : null}
          {isOnline && offlineReady ? 'Offline cache is ready for this device.' : null}
          {isOnline && !offlineReady ? 'Connected and syncing latest content.' : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canInstall ? (
            <button
              onClick={() => void promptInstall()}
              className="px-2.5 py-1.5 rounded-md border border-sky-300 text-sky-100 text-xs hover:bg-sky-500/20 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Install App
            </button>
          ) : null}

          {updateReady ? (
            <button
              onClick={() => void applyUpdate()}
              className="px-2.5 py-1.5 rounded-md border border-emerald-300 text-emerald-100 text-xs hover:bg-emerald-500/20 flex items-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Update Ready
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PwaStatusBanner;
