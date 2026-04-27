const NEFCORP_SOURCE = {
  id: 'nefcorp',
  label: 'NEFCORP',
  url: 'https://www.nefcorp.co.za',
  keywords: ['funding', 'entrepreneurship', 'grant', 'youth', 'business', 'loan'],
};

const MAX_LINKS_PER_SOURCE = 4;

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function sourceIdFromUrl(url) {
  return slug(url).slice(0, 36) || 'listing';
}

function extractFundingLinks(html, source) {
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const keywordRegex = new RegExp(source.keywords.join('|'), 'i');
  const uniqueLinks = new Set();
  const links = [];

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

function resolveNow(now) {
  if (now instanceof Date) {
    return now.toISOString();
  }

  if (typeof now === 'string' && now.trim()) {
    return now;
  }

  return new Date().toISOString();
}

function buildRow(source, opportunity, now, fallback = false) {
  const baseTime = new Date(now).getTime();
  const deadline = new Date(baseTime + 75 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const rowId = fallback
    ? `scraped-${source.id}-fallback`
    : `scraped-${source.id}-${sourceIdFromUrl(opportunity.url)}`;

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
      ? 'Source page was reachable but no NEFCORP-specific links were detected. Manual review recommended.'
      : `Auto-discovered from ${source.url}`,
    minAPS: 0,
    verificationSource: fallback ? 'community' : 'scraped',
    lastVerified: now,
    freshnessScore: fallback ? 55 : 92,
  };
}

async function scrapeSource(source, now, fetchImpl) {
  try {
    const response = await fetchImpl(source.url, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const fundingLinks = extractFundingLinks(html, source);

    if (fundingLinks.length === 0) {
      return [buildRow(source, { url: source.url, text: 'Funding listing' }, now, true)];
    }

    return fundingLinks.map((opportunity) => buildRow(source, opportunity, now));
  } catch (error) {
    const fallback = buildRow(source, { url: source.url, text: 'Manual review required' }, now, true);
    fallback.description = `Scrape fallback generated due to access failure: ${String(error)}`;
    fallback.freshnessScore = 20;
    return [fallback];
  }
}

export { NEFCORP_SOURCE };

export async function scrapeNefcorpFunding(options = {}) {
  const now = resolveNow(options.now);
  const fetchImpl = options.fetchImpl || fetch;

  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is unavailable');
  }

  return scrapeSource(NEFCORP_SOURCE, now, fetchImpl);
}
