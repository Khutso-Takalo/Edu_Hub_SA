import { describe, expect, it, vi } from 'vitest';
import { buildGoogleCustomSearchUrl, GoogleCustomSearchService } from '@/lib/googleCustomSearch';

describe('GoogleCustomSearchService', () => {
  it('builds a Google Custom Search URL', () => {
    const url = buildGoogleCustomSearchUrl('site:*.za bursary', {
      apiKey: 'api-key-123',
      searchEngineId: 'engine-456',
      baseUrl: 'https://example.com/customsearch',
      numResults: 5,
      start: 3,
    });

    expect(url).toContain('https://example.com/customsearch');
    expect(url).toContain('key=api-key-123');
    expect(url).toContain('cx=engine-456');
    expect(url).toContain('q=site%3A*.za+bursary');
    expect(url).toContain('num=5');
    expect(url).toContain('start=3');
  });

  it('returns a disabled response when the API is not configured', async () => {
    const response = await GoogleCustomSearchService.search('site:*.za bursary', {
      fetchImpl: vi.fn(),
    });

    expect(response.enabled).toBe(false);
    expect(response.results).toEqual([]);
    expect(response.message).toMatch(/not configured/i);
  });

  it('normalizes Google Custom Search results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            title: 'NEFCORP Funding',
            link: 'https://example.com/funding',
            snippet: 'Funding opportunity',
            displayLink: 'example.com',
          },
        ],
      }),
    });

    const response = await GoogleCustomSearchService.search('site:nefcorp.co.za funding', {
      apiKey: 'api-key-123',
      searchEngineId: 'engine-456',
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.enabled).toBe(true);
    expect(response.results).toEqual([
      {
        title: 'NEFCORP Funding',
        link: 'https://example.com/funding',
        snippet: 'Funding opportunity',
        displayLink: 'example.com',
      },
    ]);
  });
});
