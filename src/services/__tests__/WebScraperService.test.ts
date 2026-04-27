import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebScraperService } from '@/services/WebScraperService';

describe('WebScraperService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts bursary links from source pages', async () => {
    const html = `
      <html>
        <body>
          <a href="/funding/bursary-2026">Apply for bursary 2026</a>
          <a href="/about">About us</a>
        </body>
      </html>
    `;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    });

    vi.stubGlobal('fetch', fetchMock);

    const rows = await WebScraperService.scrapeBursaries();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.some((row) => row.verificationSource === 'scraped')).toBe(true);
    expect(rows.some((row) => row.link.includes('bursary'))).toBe(true);
  });

  it('creates fallback rows when a source is unreachable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await WebScraperService.scrapeBursaries();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.verificationSource === 'community')).toBe(true);
    expect(rows.every((row) => row.id.includes('unreachable'))).toBe(true);
  });

  it('applies persona profile hints to scraped row shaping', async () => {
    const html = `
      <html>
        <body>
          <a href="/opportunities/cybersecurity-bursary-2026">Cybersecurity bursary 2026</a>
        </body>
      </html>
    `;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    });

    vi.stubGlobal('fetch', fetchMock);

    const rows = await WebScraperService.scrapeBursaries({
      personaProfile: {
        personaType: 'learner',
        province: 'Gauteng',
        interests: ['Technology & IT'],
        priorityKeywords: ['cybersecurity'],
      },
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.field === 'Technology & IT')).toBe(true);
    expect(rows.some((row) => row.eligibility.includes('Gauteng'))).toBe(true);
  });
});
