import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_REGISTRY_PATH = ['src', 'data', 'sourceRegistry.json'];
const DEFAULT_OUTPUT_PATH = ['src', 'data', 'seed', 'source-catalog.json'];
const DEFAULT_REPORT_PATH = ['data', 'seed', 'source-catalog.report.json'];
const DEFAULT_FRONTEND_REPORT_PATH = ['src', 'data', 'seed', 'source-catalog.report.json'];
const MAX_LINKS_PER_SOURCE = 4;

const SOURCE_KEYWORDS = {
  nsfas: ['bursary', 'funding', 'application', 'student', 'study'],
  sayouth: ['job', 'learnership', 'internship', 'apprenticeship', 'opportunity'],
  nefcorp: ['funding', 'entrepreneurship', 'grant', 'youth', 'business', 'loan'],
  'dbe-papers': ['paper', 'memo', 'exam', 'past paper', 'pdf'],
  siyavula: ['textbook', 'worksheet', 'lesson', 'grade', 'caps'],
  siu: ['fraud', 'scam', 'warning', 'report', 'corruption'],
  sadag: ['helpline', 'counselling', 'support', 'crisis', 'service'],
};

const EXCLUDED_HOST_PATTERNS = [
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'linkedin.com',
  'wa.me',
  'whatsapp.com',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const registryIndex = args.indexOf('--registry');
  const outIndex = args.indexOf('--out');
  const reportIndex = args.indexOf('--report');
  const frontendReportIndex = args.indexOf('--frontend-report');

  return {
    registryPath: registryIndex >= 0 && args[registryIndex + 1] ? args[registryIndex + 1] : DEFAULT_REGISTRY_PATH.join('/'),
    outPath: outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : DEFAULT_OUTPUT_PATH.join('/'),
    reportPath: reportIndex >= 0 && args[reportIndex + 1] ? args[reportIndex + 1] : DEFAULT_REPORT_PATH.join('/'),
    frontendReportPath:
      frontendReportIndex >= 0 && args[frontendReportIndex + 1]
        ? args[frontendReportIndex + 1]
        : DEFAULT_FRONTEND_REPORT_PATH.join('/'),
  };
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function dedupeKeywords(keywords) {
  return [...new Set(keywords.map((keyword) => String(keyword || '').trim().toLowerCase()).filter(Boolean))];
}

function buildKeywords(source) {
  const baseKeywords = SOURCE_KEYWORDS[source.id] || [];
  const dataPointKeywords = Array.isArray(source.dataPoints) ? source.dataPoints : [];
  const sourceNameKeywords = String(source.name || '')
    .split(/\s+/)
    .map((part) => part.toLowerCase())
    .filter(Boolean);

  return dedupeKeywords([...baseKeywords, ...dataPointKeywords, ...sourceNameKeywords]);
}

function extractLinks(html, source, keywords) {
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const escapedKeywords = keywords.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(Boolean);
  const keywordRegex = escapedKeywords.length > 0 ? new RegExp(escapedKeywords.join('|'), 'i') : null;
  const uniqueLinks = new Set();
  const scoredLinks = [];

  const sourceHost = (() => {
    try {
      return new URL(source.url).hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
      return '';
    }
  })();

  const isExcludedHost = (hostname) => {
    return EXCLUDED_HOST_PATTERNS.some((pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`));
  };

  let match;
  while ((match = anchorRegex.exec(html)) !== null) {
    const hrefRaw = match[1] || '';
    const text = (match[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    let absoluteHref;
    try {
      absoluteHref = new URL(hrefRaw, source.url).toString();
    } catch {
      continue;
    }

    let hrefUrl;
    try {
      hrefUrl = new URL(absoluteHref);
    } catch {
      continue;
    }

    if (!/^https?:$/i.test(hrefUrl.protocol)) {
      continue;
    }

    if (hrefUrl.hash && hrefUrl.pathname.replace(/\/$/, '') === '/' && hrefUrl.search === '') {
      continue;
    }

    const normalizedHost = hrefUrl.hostname.replace(/^www\./i, '').toLowerCase();
    if (isExcludedHost(normalizedHost)) {
      continue;
    }

    if (uniqueLinks.has(absoluteHref)) {
      continue;
    }

    const haystack = `${absoluteHref} ${text}`;
    if (keywordRegex && !keywordRegex.test(haystack)) {
      continue;
    }

    const keywordHits = escapedKeywords.reduce((acc, keyword) => {
      return acc + (new RegExp(keyword, 'i').test(haystack) ? 1 : 0);
    }, 0);

    const onSourceHost = normalizedHost === sourceHost;
    const isDocumentLike = /pdf|download|apply|application|bursary|funding|programme|program|resource|paper|memo|guide/i.test(haystack);

    let score = keywordHits;
    if (onSourceHost) score += 2;
    if (isDocumentLike) score += 2;
    if (text.length > 8) score += 1;

    uniqueLinks.add(absoluteHref);
    scoredLinks.push({
      url: absoluteHref,
      text: text || 'Source link',
      score,
    });
  }

  return scoredLinks
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LINKS_PER_SOURCE)
    .map(({ url, text }) => ({ url, text }));
}

function buildFallback(source, now, reason) {
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.url,
    layer: source.layer,
    priority: source.priority,
    status: reason === 'unreachable' ? 'unreachable' : 'fallback',
    checkedAt: now,
    matchedLinks: [],
    keywordsUsed: buildKeywords(source),
    note: reason === 'unreachable'
      ? 'Source could not be fetched. Manual review recommended.'
      : 'Source page was reachable, but no matching links were detected.',
  };
}

async function loadRegistry(filePath) {
  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed || !Array.isArray(parsed.dataSources)) {
    throw new Error('Registry file must contain a dataSources array');
  }

  return parsed.dataSources;
}

async function main() {
  const args = parseArgs();
  const root = resolve(process.cwd());
  const registryPath = resolve(root, args.registryPath);
  const outPath = resolve(root, args.outPath);
  const reportPath = resolve(root, args.reportPath);
  const frontendReportPath = resolve(root, args.frontendReportPath);
  const now = new Date().toISOString();
  const sources = await loadRegistry(registryPath);

  const catalog = [];
  const reportSources = [];

  for (const source of sources) {
    const keywords = buildKeywords(source);

    try {
      const response = await fetch(source.url, { method: 'GET' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const matchedLinks = extractLinks(html, source, keywords);
      const status = matchedLinks.length > 0 ? 'matched' : 'fallback';

      catalog.push({
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        layer: source.layer,
        priority: source.priority,
        status,
        checkedAt: now,
        matchedLinks,
        keywordsUsed: keywords,
        note: matchedLinks.length > 0
          ? `Matched ${matchedLinks.length} link(s).`
          : 'Source page was reachable, but no matching links were detected.',
      });

      reportSources.push({
        sourceId: source.id,
        status,
        matchedLinks: matchedLinks.length,
        keywordsUsed: keywords.length,
      });
    } catch (error) {
      const fallback = buildFallback(source, now, 'unreachable');
      fallback.note = `Source could not be fetched: ${String(error)}`;
      catalog.push(fallback);
      reportSources.push({
        sourceId: source.id,
        status: fallback.status,
        matchedLinks: 0,
        keywordsUsed: keywords.length,
      });
    }
  }

  const report = {
    generatedAt: now,
    registryPath: args.registryPath,
    sourceCount: sources.length,
    matchedCount: catalog.filter((item) => item.status === 'matched').length,
    fallbackCount: catalog.filter((item) => item.status === 'fallback').length,
    unreachableCount: catalog.filter((item) => item.status === 'unreachable').length,
    outputPath: args.outPath,
    sources: reportSources,
  };

  await writeFile(outPath, JSON.stringify(catalog, null, 2), 'utf8');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(frontendReportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Cataloged ${sources.length} source(s).`);
  console.log(`Output written to ${args.outPath}`);
  console.log(`Report written to ${args.reportPath}`);
  console.log(`Frontend report written to ${args.frontendReportPath}`);
}

main().catch((error) => {
  console.error('Source catalog scrape failed:', error);
  process.exit(1);
});
