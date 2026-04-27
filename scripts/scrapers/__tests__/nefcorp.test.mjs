import { describe, expect, it, vi } from 'vitest';
import { scrapeNefcorpFunding } from '../nefcorp.mjs';

describe('NEFCORP scraper', () => {
  it('extracts funding links from NEFCORP pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `
        <html>
          <body>
            <a href="/funding/youth-enterprise">Youth enterprise funding</a>
            <a href="/about">About NEFCORP</a>
          </body>
        </html>
      `,
    });

    const rows = await scrapeNefcorpFunding({ fetchImpl: fetchMock, now: '2026-01-01T00:00:00.000Z' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows.some((row) => row.verificationSource === 'scraped')).toBe(true);
    expect(rows.some((row) => row.link.includes('/funding/youth-enterprise'))).toBe(true);
  });

  it('returns a fallback row when the source cannot be scraped', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));

    const rows = await scrapeNefcorpFunding({ fetchImpl: fetchMock, now: '2026-01-01T00:00:00.000Z' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.verificationSource).toBe('community');
    expect(rows[0]?.id).toContain('fallback');
  });
});
