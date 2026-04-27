const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'by',
  'at',
  'from',
]);

const PROVINCES = [
  'gauteng',
  'western cape',
  'kwazulu-natal',
  'eastern cape',
  'free state',
  'limpopo',
  'mpumalanga',
  'north west',
  'northern cape',
];

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(query: string) {
  return normalizeText(query)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function levenshteinDistance(a: string, b: string) {
  const left = normalizeText(a);
  const right = normalizeText(b);

  if (left === right) return 0;
  if (left.length === 0) return right.length;
  if (right.length === 0) return left.length;

  const matrix: number[][] = Array.from({ length: right.length + 1 }, (_, row) => [row]);

  for (let column = 0; column <= left.length; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= right.length; row += 1) {
    for (let column = 1; column <= left.length; column += 1) {
      const cost = left[column - 1] === right[row - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[right.length][left.length];
}

function similarityScore(query: string, candidate: string) {
  const normalizedQuery = normalizeText(query);
  const normalizedCandidate = normalizeText(candidate);

  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedCandidate === normalizedQuery) return 1;
  if (normalizedCandidate.includes(normalizedQuery)) return 0.92;

  const distance = levenshteinDistance(normalizedQuery, normalizedCandidate);
  const maxLength = Math.max(normalizedQuery.length, normalizedCandidate.length);
  return Math.max(0, 1 - distance / Math.max(1, maxLength));
}

function getDeadlineDays(deadline?: string) {
  if (!deadline) return Number.POSITIVE_INFINITY;

  const deadlineTime = new Date(deadline).getTime();
  if (Number.isNaN(deadlineTime)) return Number.POSITIVE_INFINITY;

  return Math.max(0, Math.ceil((deadlineTime - Date.now()) / (1000 * 60 * 60 * 24)));
}

export interface SearchRankingOptions<T> {
  limit?: number;
  minScore?: number;
  getFields: (item: T) => string[];
  getPrimaryLabel?: (item: T) => string;
  getSecondarySignals?: (item: T, query: string, tokens: string[]) => number;
  tieBreak?: (a: T, b: T) => number;
}

export interface RankedSearchResult<T> {
  item: T;
  score: number;
  matchedTokens: string[];
}

export function rankSearchResults<T>(items: T[], query: string, options: SearchRankingOptions<T>) {
  const normalizedQuery = normalizeText(query);
  const tokens = tokenize(query);
  const minScore = options.minScore ?? 0;
  const limit = options.limit ?? items.length;

  if (!normalizedQuery) {
    return items.slice(0, limit).map((item) => ({ item, score: 0, matchedTokens: [] as string[] }));
  }

  const results = items
    .map((item) => {
      const fields = options.getFields(item).filter(Boolean);
      const primaryLabel = options.getPrimaryLabel?.(item) || fields[0] || '';

      let score = 0;
      const matchedTokens = new Set<string>();

      fields.forEach((field, fieldIndex) => {
        const normalizedField = normalizeText(field);
        if (!normalizedField) return;

        const fieldWeight = Math.max(0.5, 1.2 - fieldIndex * 0.15);

        if (normalizedField === normalizedQuery) {
          score += 12 * fieldWeight;
        } else if (normalizedField.includes(normalizedQuery)) {
          score += 8 * fieldWeight;
        } else {
          score += similarityScore(normalizedQuery, normalizedField) * 5 * fieldWeight;
        }

        if (normalizedField.startsWith(normalizedQuery)) {
          score += 2.5 * fieldWeight;
        }

        tokens.forEach((token) => {
          if (!normalizedField.includes(token)) return;
          matchedTokens.add(token);
          score += normalizedField.startsWith(token) ? 2.2 : 1.2;
        });
      });

      const primaryMatchBoost = similarityScore(normalizedQuery, primaryLabel);
      score += primaryMatchBoost * 4;

      if (tokens.length > 0) {
        score += (matchedTokens.size / tokens.length) * 3;
      }

      score += options.getSecondarySignals?.(item, normalizedQuery, tokens) ?? 0;

      return {
        item,
        score,
        matchedTokens: [...matchedTokens],
      };
    })
    .filter((result) => result.score >= minScore)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (options.tieBreak) {
        return options.tieBreak(a.item, b.item);
      }

      return 0;
    })
    .slice(0, limit);

  return results;
}

export function searchBursaries<T extends { name: string; provider: string; field: string; description: string; deadline?: string; provinceEligibility?: string[]; verificationStatus?: string; freshnessScore?: number; linkHealthStatus?: string; isGolden?: boolean; minAPS?: number }>(items: T[], query: string, options: { limit?: number; urgency?: boolean } = {}) {
  return rankSearchResults(items, query, {
    limit: options.limit,
    minScore: 1,
    getFields: (item) => [item.name, item.provider, item.field, item.description],
    getPrimaryLabel: (item) => item.name,
    getSecondarySignals: (item, normalizedQuery, tokens) => {
      let score = 0;
      const deadlineDays = getDeadlineDays(item.deadline);

      if (item.isGolden) score += 1.5;
      if (item.verificationStatus === 'verified') score += 1.1;
      if (item.linkHealthStatus === 'healthy') score += 0.8;

      if (typeof item.freshnessScore === 'number') {
        score += item.freshnessScore / 30;
      }

      if (options.urgency) {
        if (deadlineDays <= 7) score += 4;
        else if (deadlineDays <= 30) score += 2.5;
        else if (deadlineDays <= 90) score += 1;
      }

      if (/deadline|closing|urgent|apply|submit/.test(normalizedQuery)) {
        if (deadlineDays <= 30) score += 2.5;
      }

      if (/aps|points|entry/.test(normalizedQuery) && typeof item.minAPS === 'number') {
        score += Math.max(0, 4 - item.minAPS / 10);
      }

      const provinceQuery = PROVINCES.find((province) => normalizedQuery.includes(province));
      if (provinceQuery) {
        score += item.provinceEligibility?.some((province) => normalizeText(province).includes(provinceQuery)) ? 3 : 0;
      }

      if (tokens.some((token) => ['nsfas', 'funding', 'stipend', 'tuition'].includes(token))) {
        score += item.field === 'All Fields' ? 1 : 0.5;
      }

      return score;
    },
    tieBreak: (a, b) => getDeadlineDays((a as T & { deadline?: string }).deadline) - getDeadlineDays((b as T & { deadline?: string }).deadline),
  });
}

export function searchInstitutions<T extends { name: string; location: string; province: string; courses: string[]; description: string; rating?: number }>(items: T[], query: string, options: { limit?: number } = {}) {
  return rankSearchResults(items, query, {
    limit: options.limit,
    minScore: 1,
    getFields: (item) => [item.name, item.location, item.province, ...item.courses, item.description],
    getPrimaryLabel: (item) => item.name,
    getSecondarySignals: (item, normalizedQuery) => {
      let score = 0;

      if (normalizeText(item.province).includes(normalizedQuery)) score += 2.5;
      if (normalizeText(item.location).includes(normalizedQuery)) score += 2;
      if (item.courses.some((course) => normalizeText(course).includes(normalizedQuery))) score += 1.8;
      if (typeof item.rating === 'number') score += item.rating / 5;

      return score;
    },
    tieBreak: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  });
}

export function searchCareers<T extends { name: string; field: string; description: string; requiredSubjects: string[]; interests: string[]; demandLevel?: string }>(items: T[], query: string, options: { limit?: number } = {}) {
  return rankSearchResults(items, query, {
    limit: options.limit,
    minScore: 1,
    getFields: (item) => [item.name, item.field, item.description, ...item.requiredSubjects, ...item.interests],
    getPrimaryLabel: (item) => item.name,
    getSecondarySignals: (item, normalizedQuery) => {
      let score = 0;
      if (item.demandLevel === 'High') score += 0.8;
      if (normalizeText(item.field).includes(normalizedQuery)) score += 1.5;
      if (item.interests.some((interest) => normalizeText(interest).includes(normalizedQuery))) score += 1.4;
      return score;
    },
  });
}

export function searchPastPapers<T extends { subject: string; grade: string; year: number; paperNumber: string; type: string }>(items: T[], query: string, options: { limit?: number } = {}) {
  return rankSearchResults(items, query, {
    limit: options.limit,
    minScore: 1,
    getFields: (item) => [item.subject, item.grade, item.paperNumber, item.type, String(item.year)],
    getPrimaryLabel: (item) => item.subject,
    getSecondarySignals: () => 0,
  });
}
