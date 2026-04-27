import lmiSeed from '@/data/seed/lmi.json';
import type { Career } from '@/data/staticData';

export interface LMISignal {
  careerId: string;
  demandScore: number;
  projectedGrowthPct: number;
  openingsEstimate: number;
  signal: 'Hot' | 'Strong' | 'Stable' | 'Watch';
  source: string;
  lastUpdated: string;
}

interface ProfileLike {
  subjects?: { name: string; mark: number }[];
  career_interests?: string[];
  aps_score?: number;
}

export interface PathwayRecommendation {
  career: Career;
  demand: LMISignal;
  readinessScore: number;
  qualificationPath: 'University' | 'TVET / College' | 'Hybrid';
  missingSubjects: string[];
  steps: string[];
}

const fallbackByDemandLevel: Record<Career['demandLevel'], number> = {
  High: 82,
  Medium: 64,
  Low: 45,
};

const lmiSignals = lmiSeed as LMISignal[];

function getSignalLabel(score: number): LMISignal['signal'] {
  if (score >= 85) return 'Hot';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Stable';
  return 'Watch';
}

export function getLMISignal(career: Career): LMISignal {
  const found = lmiSignals.find((signal) => signal.careerId === career.id);
  if (found) return found;

  const demandScore = fallbackByDemandLevel[career.demandLevel];
  return {
    careerId: career.id,
    demandScore,
    projectedGrowthPct: Math.max(2, Math.round((demandScore - 40) / 6)),
    openingsEstimate: Math.max(600, demandScore * 25),
    signal: getSignalLabel(demandScore),
    source: 'Local demand baseline',
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

function inferQualificationPath(career: Career): PathwayRecommendation['qualificationPath'] {
  const courses = career.exampleCourses.join(' ').toLowerCase();
  const hasDegreeOnly = /bsc|beng|bcom|bachelor|bacc/.test(courses);
  const hasTVET = /ncv|n1|n2|n3|n4|n5|n6|diploma|certificate|trade/.test(courses);

  if (hasDegreeOnly && !hasTVET) return 'University';
  if (!hasDegreeOnly && hasTVET) return 'TVET / College';
  return 'Hybrid';
}

function buildPathwaySteps(career: Career, demand: LMISignal, profile?: ProfileLike): string[] {
  const aps = profile?.aps_score || 0;
  const steps = [
    `Target ${career.requiredSubjects.slice(0, 3).join(', ')} as core subjects for ${career.name}.`,
    `Prioritize programmes aligned with ${inferQualificationPath(career)} routes.`,
    `Track bursaries and applications monthly while demand is ${demand.signal.toLowerCase()}.`,
  ];

  if (career.minAPS > 0 && aps > 0 && aps < career.minAPS) {
    steps.unshift(`Raise APS by ${career.minAPS - aps} points to reach typical entry threshold (${career.minAPS}).`);
  }

  return steps;
}

function getReadinessScore(career: Career, profile?: ProfileLike): number {
  if (!profile) return 45;

  const subjectNames = new Set((profile.subjects || []).map((subject) => subject.name));
  const subjectMatchCount = career.requiredSubjects.filter((name) => subjectNames.has(name)).length;
  const subjectRatio = career.requiredSubjects.length === 0
    ? 1
    : subjectMatchCount / career.requiredSubjects.length;

  let score = Math.round(subjectRatio * 55);

  const aps = profile.aps_score || 0;
  if (career.minAPS === 0) {
    score += 20;
  } else if (aps >= career.minAPS) {
    score += 30;
  } else if (aps >= career.minAPS - 4) {
    score += 18;
  } else {
    score += 8;
  }

  const hasInterestMatch = (career.interests || []).some((interest) =>
    (profile.career_interests || []).includes(interest)
  );
  if (hasInterestMatch) score += 15;

  return Math.max(0, Math.min(100, score));
}

export function getPathwayRecommendations(careers: Career[], profile?: ProfileLike, limit = 4): PathwayRecommendation[] {
  return careers
    .map((career) => {
      const demand = getLMISignal(career);
      const readinessScore = getReadinessScore(career, profile);
      const missingSubjects = career.requiredSubjects.filter((subject) =>
        !(profile?.subjects || []).some((userSubject) => userSubject.name === subject)
      );

      return {
        career,
        demand,
        readinessScore,
        qualificationPath: inferQualificationPath(career),
        missingSubjects,
        steps: buildPathwaySteps(career, demand, profile),
      };
    })
    .sort((a, b) => {
      const aRank = a.demand.demandScore * 0.6 + a.readinessScore * 0.4;
      const bRank = b.demand.demandScore * 0.6 + b.readinessScore * 0.4;
      return bRank - aRank;
    })
    .slice(0, limit);
}
