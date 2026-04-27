import type { Bursary } from '@/data/staticData';
import type { Career } from '@/data/staticData';
import type { Institution } from '@/data/staticData';
import type { PastPaper } from '@/data/staticData';

const MIN_BURSARY_FRESHNESS_SCORE = 20;

export function hasValidExternalUrl(url?: string) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isDisplayableBursary(bursary: Bursary) {
  return hasValidExternalUrl(bursary.link) && (bursary.freshnessScore ?? 0) >= MIN_BURSARY_FRESHNESS_SCORE;
}

export function filterDisplayableBursaries(bursaries: Bursary[]) {
  return bursaries.filter(isDisplayableBursary);
}

export function isDisplayableInstitution(institution: Institution) {
  return hasValidExternalUrl(institution.website) && institution.courses.length > 0 && institution.name.trim().length > 0;
}

export function filterDisplayableInstitutions(institutions: Institution[]) {
  return institutions.filter(isDisplayableInstitution);
}

export function isDisplayableCareer(career: Career) {
  return (
    career.name.trim().length > 0 &&
    career.field.trim().length > 0 &&
    career.description.trim().length > 0 &&
    career.requiredSubjects.length > 0 &&
    career.exampleCourses.length > 0 &&
    career.recommendedInstitutions.length > 0 &&
    career.salary.trim().length > 0
  );
}

export function filterDisplayableCareers(careers: Career[]) {
  return careers.filter(isDisplayableCareer);
}

export function isDownloadablePastPaper(paper: PastPaper) {
  return hasValidExternalUrl(paper.link);
}
