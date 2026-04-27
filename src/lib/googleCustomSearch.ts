import type { QueryRegistryEntry } from '@/lib/dataSourceRegistry';
import { runtimeEnv } from '@/lib/runtimeEnv';

export interface GoogleCustomSearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

export interface GoogleCustomSearchResponse {
  enabled: boolean;
  query: string;
  message: string;
  results: GoogleCustomSearchResult[];
}

export interface GoogleCustomSearchOptions {
  apiKey?: string;
  searchEngineId?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  numResults?: number;
  start?: number;
}

export interface GoogleCustomSearchRegistryResult {
  entry: QueryRegistryEntry;
  response: GoogleCustomSearchResponse;
}

interface GoogleCustomSearchRuntimeConfig {
  apiKey: string;
  searchEngineId: string;
  baseUrl: string;
}

interface GoogleCustomSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
  displayLink?: string;
}

const DEFAULT_BASE_URL = 'https://customsearch.googleapis.com/customsearch/v1';

function readRuntimeEnv(): Partial<GoogleCustomSearchRuntimeConfig> {
  return {
    apiKey: runtimeEnv.googleCustomSearchApiKey,
    searchEngineId: runtimeEnv.googleCustomSearchEngineId,
    baseUrl: runtimeEnv.googleCustomSearchBaseUrl || DEFAULT_BASE_URL,
  };
}

function resolveConfig(options: GoogleCustomSearchOptions = {}): GoogleCustomSearchRuntimeConfig {
  const runtimeEnv = readRuntimeEnv();

  return {
    apiKey: options.apiKey?.trim() || runtimeEnv.apiKey || '',
    searchEngineId: options.searchEngineId?.trim() || runtimeEnv.searchEngineId || '',
    baseUrl: options.baseUrl?.trim() || runtimeEnv.baseUrl || DEFAULT_BASE_URL,
  };
}

function normalizeItem(item: GoogleCustomSearchItem, query: string): GoogleCustomSearchResult {
  return {
    title: item.title?.trim() || query,
    link: item.link?.trim() || '',
    snippet: item.snippet?.trim() || '',
    displayLink: item.displayLink?.trim() || '',
  };
}

export function buildGoogleCustomSearchUrl(query: string, options: GoogleCustomSearchOptions = {}) {
  const config = resolveConfig(options);
  const url = new URL(config.baseUrl);

  url.searchParams.set('key', config.apiKey);
  url.searchParams.set('cx', config.searchEngineId);
  url.searchParams.set('q', query);
  url.searchParams.set('num', String(Math.max(1, Math.min(options.numResults ?? 10, 10))));

  if (options.start && options.start > 1) {
    url.searchParams.set('start', String(options.start));
  }

  return url.toString();
}

export class GoogleCustomSearchService {
  static async search(query: string, options: GoogleCustomSearchOptions = {}): Promise<GoogleCustomSearchResponse> {
    const config = resolveConfig(options);

    if (!config.apiKey || !config.searchEngineId) {
      return {
        enabled: false,
        query,
        message: 'Google Custom Search is not configured yet.',
        results: [],
      };
    }

    const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
    if (typeof fetchImpl !== 'function') {
      throw new Error('Fetch API is unavailable');
    }

    const response = await fetchImpl(buildGoogleCustomSearchUrl(query, options), { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Google Custom Search request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as { items?: GoogleCustomSearchItem[] };
    const results = Array.isArray(payload.items)
      ? payload.items.map((item) => normalizeItem(item, query))
      : [];

    return {
      enabled: true,
      query,
      message: results.length > 0 ? `Returned ${results.length} result(s).` : 'No search results were returned.',
      results,
    };
  }

  static async searchRegistryEntries(
    entries: QueryRegistryEntry[],
    options: GoogleCustomSearchOptions = {}
  ): Promise<GoogleCustomSearchRegistryResult[]> {
    const results: GoogleCustomSearchRegistryResult[] = [];

    for (const entry of entries) {
      const response = await GoogleCustomSearchService.search(entry.query, options);
      results.push({ entry, response });
    }

    return results;
  }
}
