import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../infrastructure/database/indexeddb/schema';
import { seedDatabase } from '../infrastructure/database/indexeddb/seed';
import { bursaryRepository } from '../infrastructure/database/indexeddb/repositories/BursaryRepository';
import { applicationRepository } from '../infrastructure/database/indexeddb/repositories/ApplicationRepository';

const DatabaseContext = createContext(null);

export function DatabaseProvider({ children }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await db.open();
      await seedDatabase();
      setIsReady(true);
    };
    init();
  }, []);

  const value = {
    bursaryRepo: bursaryRepository,
    applicationRepo: applicationRepository,
  };

  if (!isReady) return <div className="p-4">Loading local database...</div>;

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) throw new Error('useDatabase must be used within DatabaseProvider');
  return context;
}