import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NEFCORP_SOURCE, scrapeNefcorpFunding } from './nefcorp.mjs';
import { createHash } from 'node:crypto';

const SOURCE_DEFINITIONS = [
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
  NEFCORP_SOURCE,
];

const DEFAULT_OUTPUT_PATH = ['data', 'seed', 'bursaries.scraped.json'];
const DEFAULT_SEED_PATH = ['src', 'data', 'seed', 'bursaries.json'];
const DEFAULT_REPORT_PATH = ['data', 'seed', 'bursaries.scrape-report.json'];
const MAX_LINKS_PER_SOURCE = 4;

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function hash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 10);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const mergeIntoSeed = args.includes('--merge');

  const outIndex = args.indexOf('--out');
  const seedIndex = args.indexOf('--seed');
  const reportIndex = args.indexOf('--report');

  const outPath = outIndex >= 0 && args[outIndex + 1]
    ? args[outIndex + 1]
    : DEFAULT_OUTPUT_PATH.join('/');

  const seedPath = seedIndex >= 0 && args[seedIndex + 1]
    ? args[seedIndex + 1]
    : DEFAULT_SEED_PATH.join('/');

  const reportPath = reportIndex >= 0 && args[reportIndex + 1]
    ? args[reportIndex + 1]
    : DEFAULT_REPORT_PATH.join('/');

  return {
    mergeIntoSeed,
    outPath,
    seedPath,
    reportPath,
  };
}

function extractFundingLinks(html, sourceUrl, keywords) {
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const keywordRegex = new RegExp(keywords.join('|'), 'i');
  const uniqueLinks = new Set();
  const links = [];

  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const hrefRaw = match[1] || '';
    const text = (match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    let absoluteHref;
    try {
      absoluteHref = new URL(hrefRaw, sourceUrl).toString();
    } catch {
      continue;
    }

    const haystack = `${absoluteHref} ${text}`;
    if (!keywordRegex.test(haystack)) {
      continue;
    }

    if (uniqueLinks.has(absoluteHref)) {
      continue;
    }

    uniqueLinks.add(absoluteHref);
    links.push({
      url: absoluteHref,
      text: text || 'Funding opportunity',
    });

    if (links.length >= MAX_LINKS_PER_SOURCE) {
      break;
    }
  }

  return links;
}

function buildScrapedRow(source, opportunity, now, fallback = false) {
  const deadline = new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rowId = fallback
    ? `scraped-${source.id}-fallback`
    : `scraped-${source.id}-${hash(opportunity.url)}`;

  return {
    id: rowId,
    name: fallback ? `${source.label} Funding Listing` : `${source.label}: ${opportunity.text}`,
    provider: source.label,
    field: 'All Fields',
    eligibility: 'Check official source for current eligibility criteria.',
    deadline,
    amount: 'See source',
    link: fallback ? source.url : opportunity.url,
    description: fallback
      ? 'Source page was reachable but no bursary-specific links were detected. Manual review recommended.'
      : `Auto-discovered from ${source.url}`,
    minAPS: 0,
    verificationSource: fallback ? 'community' : 'scraped',
    lastVerified: now,
    freshnessScore: fallback ? 55 : 92,
  };
}

async function scrapeSource(source, now) {
  if (source.id === 'nefcorp') {
    return scrapeNefcorpFunding({ now, fetchImpl: fetch });
  }

  try {
    const response = await fetch(source.url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const fundingLinks = extractFundingLinks(html, source.url, source.keywords);

    if (fundingLinks.length === 0) {
      return [buildScrapedRow(source, { url: source.url, text: 'Funding listing' }, now, true)];
    }

    return fundingLinks.map((opportunity) => buildScrapedRow(source, opportunity, now));
  } catch (error) {
    const fallback = buildScrapedRow(source, { url: source.url, text: 'Manual review required' }, now, true);
    fallback.description = `Scrape fallback generated due to access failure: ${String(error)}`;
    fallback.freshnessScore = 20;
    return [fallback];
  }
}

function normalizeBursary(item, now) {
  return {
    ...item,
    verificationSource: item.verificationSource || 'official',
    lastVerified: item.lastVerified || now,
    freshnessScore: item.freshnessScore ?? 100,
  };
}

async function readSeedBursaries(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mergeBursaries(existing, scraped) {
  const byId = new Map(existing.map((item) => [item.id, item]));

  for (const item of scraped) {
    const previous = byId.get(item.id);
    byId.set(item.id, {
      ...previous,
      ...item,
      verificationSource: item.verificationSource || previous?.verificationSource || 'official',
      lastVerified: item.lastVerified || previous?.lastVerified || new Date().toISOString(),
      freshnessScore: item.freshnessScore ?? previous?.freshnessScore ?? 100,
    });
  }

  return [...byId.values()];
}

async function main() {
  const now = new Date().toISOString();
  const args = parseArgs();
  const root = resolve(process.cwd());
  const outputPath = resolve(root, args.outPath);
  const seedPath = resolve(root, args.seedPath);
  const reportPath = resolve(root, args.reportPath);

  const results = [];
  const sourceSummaries = [];

  for (const source of SOURCE_DEFINITIONS) {
    const rows = await scrapeSource(source, now);
    sourceSummaries.push({
      source: source.url,
      generatedRows: rows.length,
      fallbackRows: rows.filter((row) => row.verificationSource !== 'scraped').length,
    });
    results.push(...rows);
  }

  const normalizedResults = results.map((item) => normalizeBursary(item, now));
  await writeFile(outputPath, JSON.stringify(normalizedResults, null, 2), 'utf8');

  if (args.mergeIntoSeed) {
    const existing = await readSeedBursaries(seedPath);
    const merged = mergeBursaries(existing, normalizedResults);
    await writeFile(seedPath, JSON.stringify(merged, null, 2), 'utf8');
  }

  const report = {
    generatedAt: now,
    sourceCount: SOURCE_DEFINITIONS.length,
    outputCount: normalizedResults.length,
    fallbackCount: normalizedResults.filter((row) => row.verificationSource !== 'scraped').length,
    mergeIntoSeed: args.mergeIntoSeed,
    seedPath: args.seedPath,
    outputPath: args.outPath,
    sources: sourceSummaries,
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Scraped ${SOURCE_DEFINITIONS.length} sources into ${normalizedResults.length} rows.`);
  console.log(`Output written to ${args.outPath}`);
  console.log(`Report written to ${args.reportPath}`);
  if (args.mergeIntoSeed) {
    console.log(`Merged rows into ${args.seedPath}`);
  }
}

main().catch((error) => {
  console.error('Scrape job failed:', error);
  process.exit(1);
});
