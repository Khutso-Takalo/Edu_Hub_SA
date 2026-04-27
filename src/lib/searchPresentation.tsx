import React from 'react';

function normalizeTerm(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildHighlightTerms(query: string, matchedTokens: string[] = []) {
  const queryTerms = normalizeTerm(query)
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length > 1);

  return [...new Set([...matchedTokens.map((term) => normalizeTerm(term)), ...queryTerms].filter(Boolean))];
}

export function highlightText(text: string, terms: string[]) {
  const normalizedTerms = [...new Set(terms.map((term) => normalizeTerm(term)).filter(Boolean))].sort(
    (a, b) => b.length - a.length
  );

  if (normalizedTerms.length === 0) {
    return text;
  }

  const regex = new RegExp(`(${normalizedTerms.map(escapeRegExp).join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <mark key={`${text}-${index}`} className="rounded bg-amber-100 px-0.5 text-amber-900">
          {part}
        </mark>
      );
    }

    return <React.Fragment key={`${text}-${index}`}>{part}</React.Fragment>;
  });
}

export function getMatchPercent(score: number, topScore: number) {
  if (topScore <= 0 || score <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(100, Math.round((score / topScore) * 100)));
}

export function getMatchLabel(score: number, topScore: number) {
  const percent = getMatchPercent(score, topScore);
  return percent >= 100 ? 'Best match' : `${percent}% match`;
}
