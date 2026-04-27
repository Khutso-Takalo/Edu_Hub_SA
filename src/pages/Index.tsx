
import React, { Suspense, lazy } from 'react';
import { AppProvider } from '@/contexts/AppContext';

const AppLayout = lazy(() => import('@/components/AppLayout'));

const Index: React.FC = () => {
  return (
    <AppProvider>
      <Suspense
        fallback={(
          <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 px-4">
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
              Loading EduHub experience...
            </div>
          </div>
        )}
      >
        <AppLayout />
      </Suspense>
    </AppProvider>
  );
};

export default Index;
