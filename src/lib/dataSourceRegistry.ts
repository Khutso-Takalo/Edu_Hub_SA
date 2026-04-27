export type SourceLayer =
  | 'opportunity'
  | 'resources'
  | 'academic'
  | 'utilities'
  | 'trust-safety'
  | 'alternative-funding'
  | 'wellbeing';

export type SourcePriority = 'highest' | 'high' | 'medium';
export type QueryRegistryCategory =
  | 'opportunity'
  | 'resources'
  | 'academic'
  | 'tvet'
  | 'trust-safety'
  | 'alternative-funding';

export interface DataSourceDefinition {
  id: string;
  name: string;
  url: string;
  layer: SourceLayer;
  priority: SourcePriority;
  dataPoints: string[];
  strategy: string;
}

export interface QueryRegistryEntry {
  id: string;
  category: QueryRegistryCategory;
  title: string;
  query: string;
  purpose: string;
}

import sourceRegistry from '@/data/sourceRegistry.json';

export const DATA_SOURCE_REGISTRY: DataSourceDefinition[] = sourceRegistry.dataSources as DataSourceDefinition[];
export const GOOGLE_DORK_QUERY_REGISTRY: QueryRegistryEntry[] = sourceRegistry.googleQueries as QueryRegistryEntry[];
