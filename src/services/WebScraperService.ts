import type { Bursary } from '@/data/staticData';

/**
 * Browser fallback scraper used for admin/manual recovery flows only.
 * Production scraping runs from the Node.js scripts and GitHub Actions workflow.
 */
export const WEB_SCRAPER_SERVICE_MODE = 'browser-fallback' as const;

interface ScrapedBursary extends Bursary {
  sourceUrl: string;
  verificationSource: 'scraped' | 'community';
}

interface SourceDefinition {
  id: string;
  label: string;
  url: string;
  keywords: string[];
}

export interface PersonaScrapeProfile {
  personaType?: 'learner' | 'parent_guardian' | 'teacher_counselor' | 'graduate_upskiller';
  province?: string;
  interests?: string[];
  priorityKeywords?: string[];
}

interface ScrapeOptions {
  personaProfile?: PersonaScrapeProfile;
}

const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    id: 'nsfas',
    label: 'NSFAS',
    url: 'https://www.nsfas.org.za',
    keywords: ['bursary', 'funding', 'application', 'student'],
  },
  {
    id: 'sasol',
    label: 'Sasol',
    url: 'https://www.sasol.com',
    keywords: ['bursary', 'scholarship', 'graduate'],
  },
  {
    id: 'eskom',
    label: 'Eskom',
    url: 'https://www.eskom.co.za',
    keywords: ['bursary', 'internship', 'learnership'],
  },
  {
    id: 'oldmutual',
    label: 'Old Mutual',
    url: 'https://www.oldmutual.com',
    keywords: ['bursary', 'scholarship', 'academy'],
  },
];

const MAX_LINKS_PER_SOURCE = 3;

const INTEREST_KEYWORD_MAP: Record<string, string[]> = {
  'Technology & IT': ['technology', 'it', 'software', 'data', 'computer', 'cyber'],
  'Healthcare & Medicine': ['medicine', 'health', 'nursing', 'medical', 'pharmacy'],
  Engineering: ['engineering', 'mechanical', 'civil', 'electrical', 'chemical'],
  'Business & Finance': ['business', 'finance', 'accounting', 'commerce', 'economics'],
  'Education & Teaching': ['teaching', 'education', 'bed', 'teacher'],
  'Law & Justice': ['law', 'legal', 'justice', 'llb'],
  'Agriculture & Environment': ['agriculture', 'environment', 'food science', 'veterinary'],
  'Science & Research': ['science', 'research', 'laboratory', 'biotech'],
  'Trades & Technical': ['tvet', 'trade', 'artisan', 'technical', 'learnership'],
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function sourceIdFromUrl(url: string): string {
  return slug(url).slice(0, 36) || 'listing';
}

function buildPersonaKeywords(profile?: PersonaScrapeProfile) {
  if (!profile) {
    return [] as string[];
  }

  const keywords = new Set<string>();
  for (const interest of profile.interests || []) {
    for (const keyword of INTEREST_KEYWORD_MAP[interest] || []) {
      keywords.add(keyword);
    }
  }

  for (const keyword of profile.priorityKeywords || []) {
    if (keyword.trim()) {
      keywords.add(keyword.trim().toLowerCase());
    }
  }

  if (profile.province) {
    keywords.add(profile.province.toLowerCase());
  }

  return [...keywords];
}

function extractFundingLinks(html: string, source: SourceDefinition, personaKeywords: string[] = []) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a[href]'));
  const keywordRegex = new RegExp(source.keywords.join('|'), 'i');
  const personaRegex = personaKeywords.length > 0 ? new RegExp(personaKeywords.join('|'), 'i') : null;
  const dedupe = new Set<string>();

  const scored: Array<{ href: string; label: string; score: number }> = [];

  for (const anchor of links) {
    const href = anchor.getAttribute('href') || '';
    const label = (anchor.textContent || '').trim().replace(/\s+/g, ' ');

    if (!href) continue;

    const absoluteHref = (() => {
      try {
        return new URL(href, source.url).toString();
      } catch {
        return '';
      }
    })();

    if (!absoluteHref) continue;

    const text = `${absoluteHref} ${label}`;
    const baseMatch = keywordRegex.test(text);
    const personaMatch = personaRegex ? personaRegex.test(text) : false;
    if (!baseMatch && !personaMatch) continue;
    if (dedupe.has(absoluteHref)) continue;

    let score = 1;
    if (baseMatch) score += 2;
    if (personaMatch) score += 3;

    dedupe.add(absoluteHref);
    scored.push({ href: absoluteHref, label: label || 'Funding opportunity', score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_LINKS_PER_SOURCE).map(({ href, label }) => ({ href, label }));
}

function resolvePersonaField(profile?: PersonaScrapeProfile) {
  if (!profile || !profile.interests || profile.interests.length === 0) {
    return 'All Fields';
  }

  return profile.interests[0];
}

export class WebScraperService {
  static async scrapeBursaries(options: ScrapeOptions = {}): Promise<ScrapedBursary[]> {
    const results: ScrapedBursary[] = [];
    const now = new Date().toISOString();
    const personaKeywords = buildPersonaKeywords(options.personaProfile);
    const personaField = resolvePersonaField(options.personaProfile);
    const personaProvince = options.personaProfile?.province;

    for (const source of SOURCE_DEFINITIONS) {
      try {
        const response = await fetch(source.url, { method: 'GET' });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const links = extractFundingLinks(html, source, personaKeywords);

        if (links.length === 0) {
          results.push({
            id: `scrape-${source.id}-fallback`,
            name: `${source.label} Funding Listing`,
            provider: source.label,
            field: personaField,
            eligibility: personaProvince
              ? `Check source for full requirements. Priority region: ${personaProvince}.`
              : 'Check the official source website for full requirements.',
            deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            amount: 'See source',
            link: source.url,
            description: 'Source page is reachable but no bursary-specific links were detected. Manual review recommended.',
            minAPS: 0,
            sourceUrl: source.url,
            verificationSource: 'community',
            lastVerified: now,
            freshnessScore: 60,
          });
          continue;
        }

        for (const [index, match] of links.entries()) {
          results.push({
            id: `scrape-${source.id}-${index}-${sourceIdFromUrl(match.href)}`,
            name: `${source.label}: ${match.label}`,
            provider: source.label,
            field: personaField,
            eligibility: personaProvince
              ? `See source website for full requirements. Priority region: ${personaProvince}.`
              : 'See source website for full requirements.',
            deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            amount: 'See source',
            link: match.href,
            description: `Auto-captured opportunity from ${source.url}`,
            minAPS: 0,
            sourceUrl: source.url,
            verificationSource: 'scraped',
            lastVerified: now,
            freshnessScore: 90,
          });
        }
      } catch (error) {
        results.push({
          id: `scrape-${source.id}-unreachable`,
          name: `Manual review required: ${source.label}`,
          provider: source.label,
          field: personaField,
          eligibility: 'Review source manually to confirm details.',
          deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          amount: 'Unknown',
          link: source.url,
          description: `This row was added as a fallback because the source could not be scraped (${String(error)}).`,
          minAPS: 0,
          sourceUrl: source.url,
          verificationSource: 'community',
          lastVerified: now,
          freshnessScore: 25,
        });
      }
    }

    return results;
  }
}
