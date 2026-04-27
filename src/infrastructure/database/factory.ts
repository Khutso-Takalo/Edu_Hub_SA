import { indexedDbAdapter } from '@/infrastructure/database/adapters/IndexedDbAdapter';
import { supabaseAdapter } from '@/infrastructure/database/adapters/SupabaseAdapter';
import type { DataAdapter } from '@/infrastructure/database/adapter';

export type AdapterKind = 'indexeddb' | 'supabase';

export function createDataAdapter(kind: AdapterKind = 'indexeddb'): DataAdapter {
  if (kind === 'supabase') {
    return supabaseAdapter;
  }

  return indexedDbAdapter;
}
