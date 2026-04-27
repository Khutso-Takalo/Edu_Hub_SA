import type { UserProfile } from '@/hooks/useAuth';
import { supabase, runtimeEnvStatus } from '@/lib/supabase';
import {
  bursaries,
  careers,
  getCareerRecommendations,
  institutions,
  type Bursary,
  type Career,
  type Institution,
} from '@/data/staticData';

type IntentId =
  | 'career-match'
  | 'bursary-match'
  | 'aps-improvement'
  | 'pathway-choice'
  | 'nsfas-guidance'
  | 'fallback';

type TokenIntentMap = Partial<Record<IntentId, number>>;

interface LearningStore {
  version: 1;
  lastUpdated: string;
  tokenIntents: Record<string, TokenIntentMap>;
  intentCounts: Record<IntentId, number>;
  transitions: Record<IntentId, TokenIntentMap>;
  lastIntent: IntentId | null;
}

interface WeightedKeyword {
  term: string;
  weight: number;
}

interface IntentConfig {
  id: IntentId;
  keywords: WeightedKeyword[];
}

interface IntentScore {
  id: IntentId;
  score: number;
  matchedTerms: string[];
}

export interface ChatKeywordAnalysis {
  intent: IntentId;
  intentLabel: string;
  atsScore: number;
  matchedKeywords: string[];
  keywordCoverage: number;
  intentScores: IntentScore[];
}

interface LearningSignal {
  replySource: 'supabase' | 'local-fallback';
}

interface GlobalLearningEvent {
  intent: IntentId;
  atsBucket: number;
  keywordCount: number;
  queryLengthBucket: number;
  hasSubjectKeyword: boolean;
  hasCareerKeyword: boolean;
  hasFundingKeyword: boolean;
  replySource: LearningSignal['replySource'];
  occurredAt: string;
}

interface LearningSyncStore {
  version: 1;
  clientId: string;
  pending: GlobalLearningEvent[];
  lastAttemptAt?: string;
}

const INTENT_CONFIG: IntentConfig[] = [
  {
    id: 'career-match',
    keywords: [
      { term: 'career', weight: 4 },
      { term: 'job', weight: 3 },
      { term: 'in-demand', weight: 4 },
      { term: 'software', weight: 4 },
      { term: 'nurse', weight: 4 },
      { term: 'engineer', weight: 4 },
      { term: 'accountant', weight: 4 },
      { term: 'data science', weight: 4 },
      { term: 'cybersecurity', weight: 4 },
      { term: 'salary', weight: 2 },
    ],
  },
  {
    id: 'bursary-match',
    keywords: [
      { term: 'bursary', weight: 5 },
      { term: 'scholarship', weight: 4 },
      { term: 'funding', weight: 4 },
      { term: 'deadline', weight: 3 },
      { term: 'apply', weight: 2 },
      { term: 'sasol', weight: 3 },
      { term: 'mtn', weight: 3 },
      { term: 'eskom', weight: 3 },
      { term: 'funza lushaka', weight: 4 },
      { term: 'dh et tvet bursary', weight: 3 },
    ],
  },
  {
    id: 'aps-improvement',
    keywords: [
      { term: 'aps', weight: 6 },
      { term: 'marks', weight: 3 },
      { term: 'improve', weight: 3 },
      { term: 'grade 12', weight: 3 },
      { term: 'subjects', weight: 2 },
      { term: 'study tips', weight: 3 },
      { term: 'mathematics', weight: 2 },
      { term: 'physical sciences', weight: 2 },
      { term: 'life sciences', weight: 2 },
    ],
  },
  {
    id: 'pathway-choice',
    keywords: [
      { term: 'tvet', weight: 5 },
      { term: 'university', weight: 5 },
      { term: 'college', weight: 3 },
      { term: 'private college', weight: 3 },
      { term: 'ncv', weight: 3 },
      { term: 'diploma', weight: 2 },
      { term: 'degree', weight: 2 },
      { term: 'pathway', weight: 2 },
      { term: 'which is better', weight: 2 },
    ],
  },
  {
    id: 'nsfas-guidance',
    keywords: [
      { term: 'nsfas', weight: 6 },
      { term: 'financial aid', weight: 3 },
      { term: 'household income', weight: 3 },
      { term: 'supporting documents', weight: 3 },
      { term: 'allowance', weight: 2 },
      { term: 'application status', weight: 2 },
    ],
  },
];

const INTENT_LABELS: Record<IntentId, string> = {
  'career-match': 'Career Match',
  'bursary-match': 'Bursary Match',
  'aps-improvement': 'APS Improvement',
  'pathway-choice': 'Pathway Decision',
  'nsfas-guidance': 'NSFAS Guidance',
  fallback: 'General Guidance',
};

const LEARNING_STORAGE_KEY = 'eduhub:chat-learning:v1';
const LEARNING_SYNC_STORAGE_KEY = 'eduhub:chat-learning-sync:v1';
const LEARNING_SYNC_DISABLED_KEY = 'eduhub:chat-learning-sync-disabled:v1';
const MAX_PENDING_SYNC_EVENTS = 300;
const MAX_BATCH_SYNC_EVENTS = 25;
const MIN_SYNC_INTERVAL_MS = 10_000;
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'what', 'how', 'when', 'where', 'which', 'into',
  'about', 'have', 'has', 'are', 'can', 'you', 'our', 'their', 'would', 'should', 'will', 'need', 'want', 'help',
  'please', 'more', 'best', 'than', 'then', 'was', 'were', 'had', 'also', 'them', 'they', 'some', 'just', 'like',
]);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

let syncInFlight = false;
let lastSyncAttemptMs = 0;

const emptyIntentCounts = (): Record<IntentId, number> => ({
  'career-match': 0,
  'bursary-match': 0,
  'aps-improvement': 0,
  'pathway-choice': 0,
  'nsfas-guidance': 0,
  fallback: 0,
});

const emptyTransitions = (): Record<IntentId, TokenIntentMap> => ({
  'career-match': {},
  'bursary-match': {},
  'aps-improvement': {},
  'pathway-choice': {},
  'nsfas-guidance': {},
  fallback: {},
});

const createLearningStore = (): LearningStore => ({
  version: 1,
  lastUpdated: new Date().toISOString(),
  tokenIntents: {},
  intentCounts: emptyIntentCounts(),
  transitions: emptyTransitions(),
  lastIntent: null,
});

const readLearningStore = (): LearningStore => {
  if (typeof window === 'undefined') return createLearningStore();

  try {
    const raw = window.localStorage.getItem(LEARNING_STORAGE_KEY);
    if (!raw) return createLearningStore();

    const parsed = JSON.parse(raw) as Partial<LearningStore>;
    if (parsed?.version !== 1) return createLearningStore();

    return {
      ...createLearningStore(),
      ...parsed,
      tokenIntents: parsed.tokenIntents || {},
      intentCounts: { ...emptyIntentCounts(), ...(parsed.intentCounts || {}) },
      transitions: { ...emptyTransitions(), ...(parsed.transitions || {}) },
      lastIntent: parsed.lastIntent || null,
    };
  } catch {
    return createLearningStore();
  }
};

const writeLearningStore = (store: LearningStore) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LEARNING_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage write failures for learning metadata.
  }
};

const createLearningSyncStore = (): LearningSyncStore => ({
  version: 1,
  clientId: `client-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
  pending: [],
});

const readLearningSyncStore = (): LearningSyncStore => {
  if (typeof window === 'undefined') return createLearningSyncStore();

  try {
    const raw = window.localStorage.getItem(LEARNING_SYNC_STORAGE_KEY);
    if (!raw) return createLearningSyncStore();

    const parsed = JSON.parse(raw) as Partial<LearningSyncStore>;
    if (parsed?.version !== 1 || !parsed.clientId) return createLearningSyncStore();

    return {
      ...createLearningSyncStore(),
      ...parsed,
      pending: Array.isArray(parsed.pending) ? parsed.pending : [],
    };
  } catch {
    return createLearningSyncStore();
  }
};

const writeLearningSyncStore = (store: LearningSyncStore) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LEARNING_SYNC_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore sync queue write failures.
  }
};

const enqueueGlobalLearningEvent = (event: GlobalLearningEvent) => {
  const store = readLearningSyncStore();
  const pending = [...store.pending, event].slice(-MAX_PENDING_SYNC_EVENTS);

  writeLearningSyncStore({
    ...store,
    pending,
    lastAttemptAt: new Date().toISOString(),
  });
};

const flushGlobalLearningQueue = async () => {
  if (typeof window === 'undefined') return;
  if (import.meta.env.VITE_ENABLE_CHAT_LEARNING_SYNC !== 'true') return;
  if (!runtimeEnvStatus.isSupabaseConfigured || !supabase) return;
  if (syncInFlight) return;
  if (window.localStorage.getItem(LEARNING_SYNC_DISABLED_KEY) === '1') return;
  if (window.navigator && !window.navigator.onLine) return;

  const now = Date.now();
  if (now - lastSyncAttemptMs < MIN_SYNC_INTERVAL_MS) return;
  lastSyncAttemptMs = now;

  const store = readLearningSyncStore();
  if (store.pending.length === 0) return;

  syncInFlight = true;
  try {
    const batch = store.pending.slice(0, MAX_BATCH_SYNC_EVENTS);

    const { error } = await supabase.functions.invoke('career-advisor-learning', {
      body: {
        clientId: store.clientId,
        events: batch,
      },
    });

    if (error) {
      if (/not found|404/i.test(error.message || '')) {
        window.localStorage.setItem(LEARNING_SYNC_DISABLED_KEY, '1');
      }
      return;
    }

    writeLearningSyncStore({
      ...store,
      pending: store.pending.slice(batch.length),
      lastAttemptAt: new Date().toISOString(),
    });
  } catch {
    // Keep pending queue for retry on next interaction.
  } finally {
    syncInFlight = false;
  }
};

const containsSensitivePattern = (normalizedInput: string) => {
  const emailPattern = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
  const longNumberPattern = /\b\d{8,}\b/;
  const idPattern = /\b\d{13}\b/;
  const phonePattern = /\b(\+27|0)\d{9}\b/;

  return (
    emailPattern.test(normalizedInput) ||
    longNumberPattern.test(normalizedInput) ||
    idPattern.test(normalizedInput) ||
    phonePattern.test(normalizedInput)
  );
};

const deriveSignalFlags = (normalizedInput: string) => {
  return {
    hasSubjectKeyword: /mathematics|physical sciences|life sciences|accounting|english|it|cat/.test(normalizedInput),
    hasCareerKeyword: /career|job|engineer|nurse|accountant|developer|teacher|cybersecurity/.test(normalizedInput),
    hasFundingKeyword: /bursary|nsfas|funding|scholarship|financial aid|deadline/.test(normalizedInput),
  };
};

const extractLearningTokens = (normalizedInput: string) => {
  return normalizedInput
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !STOPWORDS.has(token))
    .slice(0, 16);
};

const getLearningBoost = (
  intent: IntentId,
  tokens: string[],
  learningStore: LearningStore,
  topStaticIntent: IntentId | null
) => {
  let boost = 0;

  for (const token of tokens) {
    const tokenMap = learningStore.tokenIntents[token];
    if (!tokenMap) continue;

    const intentWeight = tokenMap[intent] || 0;
    const totalWeight = Object.values(tokenMap).reduce((acc, value) => acc + (value || 0), 0);
    if (totalWeight <= 0) continue;

    boost += (intentWeight / totalWeight) * 3.4;
  }

  if (learningStore.lastIntent && topStaticIntent && topStaticIntent !== 'fallback') {
    const transitionStrength = learningStore.transitions[learningStore.lastIntent]?.[intent] || 0;
    boost += clamp(transitionStrength * 0.35, 0, 2.4);
  }

  if (topStaticIntent === intent) {
    boost += 0.6;
  }

  return boost;
};

const computeIntentScores = (normalizedInput: string): IntentScore[] => {
  const learningStore = readLearningStore();
  const learningTokens = extractLearningTokens(normalizedInput);

  const staticScores = INTENT_CONFIG.map((config) => {
    const matchedTerms = config.keywords
      .filter((keyword) => normalizedInput.includes(keyword.term))
      .map((keyword) => keyword.term);

    const score = config.keywords.reduce(
      (acc, keyword) => (normalizedInput.includes(keyword.term) ? acc + keyword.weight : acc),
      0
    );

    return {
      id: config.id,
      score,
      matchedTerms,
    };
  });

  const topStaticIntent = [...staticScores].sort((a, b) => b.score - a.score)[0]?.id || null;

  return staticScores
    .map((item) => {
      const adaptiveBoost = getLearningBoost(item.id, learningTokens, learningStore, topStaticIntent);
      return {
        ...item,
        score: item.score + adaptiveBoost,
      };
    })
    .sort((a, b) => b.score - a.score);
};

const buildCareerResponse = (query: string, profile: UserProfile | null, analysis: ChatKeywordAnalysis): string => {
  const recommended: Career[] =
    profile?.subjects?.length && profile?.career_interests?.length
      ? getCareerRecommendations(profile.subjects, profile.career_interests, profile.aps_score || 0)
      : careers.filter((career) => career.demandLevel === 'High').slice(0, 5);

  const queryTokens = normalize(query).split(' ').filter((token) => token.length > 2);
  const refined = recommended.filter((career) => {
    const text = normalize(`${career.name} ${career.field} ${career.description}`);
    return queryTokens.some((token) => text.includes(token));
  });

  const picks = (refined.length > 0 ? refined : recommended).slice(0, 3);

  const lines = picks.map(
    (career, index) =>
      `${index + 1}. ${career.name} (${career.field})\n- Demand: ${career.demandLevel}\n- APS target: ${career.minAPS}\n- Typical salary: ${career.salary}`
  );

  return [
    '**Top career matches for you:**',
    ...lines,
    '',
    'Next step: open Career Explorer and compare entry requirements against your APS and subjects.',
  ].join('\n');
};

const buildBursaryResponse = (query: string, profile: UserProfile | null, analysis: ChatKeywordAnalysis): string => {
  const queryNorm = normalize(query);
  const tokens = queryNorm.split(' ').filter((token) => token.length > 2);

  const byKeyword = bursaries.filter((item) => {
    const text = normalize(`${item.name} ${item.provider} ${item.field} ${item.description}`);
    return tokens.some((token) => text.includes(token));
  });

  const byAps = (byKeyword.length > 0 ? byKeyword : bursaries).filter((item) => {
    if (!profile?.aps_score) return true;
    return (item.minAPS || 0) <= profile.aps_score + 2;
  });

  const picks: Bursary[] = [...byAps]
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 4);

  const lines = picks.map(
    (item, index) =>
      `${index + 1}. ${item.name} (${item.provider})\n- Field: ${item.field}\n- Deadline: ${item.deadline}\n- APS minimum: ${item.minAPS || 0}`
  );

  return [
    '**Best-fit bursary shortlist:**',
    ...lines,
    '',
    'Next step: prioritize deadlines within 30 days and prepare ID, transcript, motivation letter, and references.',
  ].join('\n');
};

const buildApsResponse = (profile: UserProfile | null, analysis: ChatKeywordAnalysis): string => {
  const aps = profile?.aps_score || 0;
  const target = Math.max(aps + 4, 28);

  return [
    `Current APS: ${aps}. Suggested short-term target: ${target}.`,
    '',
    '**APS upgrade plan:**',
    '1. Prioritize your top 6 non-Life Orientation subjects for score gains.',
    '2. Raise two weakest high-credit subjects by 5-10 points first.',
    '3. Use past papers twice weekly with timed practice.',
    '4. Track mock exam deltas every 2 weeks and adjust study blocks.',
    '5. Align target programmes with APS cut-offs + backup options.',
  ].join('\n');
};

const buildPathwayResponse = (query: string, analysis: ChatKeywordAnalysis): string => {
  const queryNorm = normalize(query);
  const preferTVET = /tvet|ncv|n[1-6]|trade|practical/.test(queryNorm);
  const preferUniversity = /university|degree|bachelor|medicine|law/.test(queryNorm);

  const topInstitutions: Institution[] = institutions
    .filter((item) => {
      if (preferTVET) return item.type === 'TVET';
      if (preferUniversity) return item.type === 'University';
      return true;
    })
    .slice(0, 3);

  const lines = topInstitutions.map(
    (item, index) => `${index + 1}. ${item.name} (${item.type}) - ${item.location}, ${item.province}`
  );

  return [
    '**TVET vs University quick logic:**',
    '- TVET: stronger for practical skills, faster work-readiness, and trade pathways.',
    '- University: stronger for degree-gated professions and research-heavy careers.',
    '',
    '**Recommended institutions to compare now:**',
    ...lines,
  ].join('\n');
};

const buildNsfasResponse = (analysis: ChatKeywordAnalysis): string => {
  void analysis;
  return [
    '**NSFAS action sequence:**',
    '1. Confirm SA citizenship and household income eligibility.',
    '2. Prepare certified ID copies, parent/guardian details, and proof documents.',
    '3. Submit application early and verify all contact details.',
    '4. Track status weekly and respond immediately to missing document requests.',
    '5. If approved, confirm registration and allowance setup with your institution.',
  ].join('\n');
};

const buildFallbackResponse = (analysis: ChatKeywordAnalysis): string => {
  void analysis;
  return [
    'Try asking with specific keywords like career, bursary, APS, NSFAS, TVET, university, deadlines, or subject names for sharper guidance.',
  ].join('\n');
};

export const analyzeChatKeywords = (query: string, profile: UserProfile | null): ChatKeywordAnalysis => {
  const normalized = normalize(query);
  const intentScores = computeIntentScores(normalized);
  const top = intentScores[0];

  const selectedIntent: IntentId = top && top.score > 0 ? top.id : 'fallback';
  const matchedKeywords = top?.matchedTerms || [];
  const keywordCoverage = top
    ? clamp(Math.round((matchedKeywords.length / Math.max(1, INTENT_CONFIG.find((item) => item.id === top.id)?.keywords.length || 1)) * 100), 0, 100)
    : 0;

  const profileBoost = profile
    ? clamp(
        (profile.subjects?.length ? 8 : 0) +
          (profile.career_interests?.length ? 8 : 0) +
          (profile.aps_score ? 8 : 0),
        0,
        24
      )
    : 0;

  const atsScore = clamp(Math.round((top?.score || 0) * 5 + keywordCoverage * 0.35 + profileBoost), 12, 100);

  return {
    intent: selectedIntent,
    intentLabel: INTENT_LABELS[selectedIntent],
    atsScore,
    matchedKeywords,
    keywordCoverage,
    intentScores,
  };
};

export const buildLocalChatReply = (
  query: string,
  profile: UserProfile | null,
  analysis: ChatKeywordAnalysis
): string => {
  switch (analysis.intent) {
    case 'career-match':
      return buildCareerResponse(query, profile, analysis);
    case 'bursary-match':
      return buildBursaryResponse(query, profile, analysis);
    case 'aps-improvement':
      return buildApsResponse(profile, analysis);
    case 'pathway-choice':
      return buildPathwayResponse(query, analysis);
    case 'nsfas-guidance':
      return buildNsfasResponse(analysis);
    case 'fallback':
    default:
      return buildFallbackResponse(analysis);
  }
};

export const isGenericAssistantReply = (reply: string) => {
  const normalized = normalize(reply);

  if (!normalized || normalized.length < 60) return true;
  if (/couldn t process|please try again|having trouble connecting|as an ai|i can t/.test(normalized)) return true;

  return false;
};

export const learnFromChatInteraction = (
  query: string,
  analysis: ChatKeywordAnalysis,
  signal: LearningSignal
) => {
  if (analysis.intent === 'fallback') return;

  const normalized = normalize(query);
  const tokens = extractLearningTokens(normalized);
  if (tokens.length === 0) return;

  const store = readLearningStore();
  const reinforcement = signal.replySource === 'supabase' ? 1.5 : 1.0;

  for (const token of tokens) {
    const tokenMap: TokenIntentMap = {
      ...(store.tokenIntents[token] || {}),
    };

    tokenMap[analysis.intent] = clamp((tokenMap[analysis.intent] || 0) + reinforcement, 0, 20);

    for (const key of Object.keys(tokenMap) as IntentId[]) {
      if (key !== analysis.intent) {
        tokenMap[key] = clamp((tokenMap[key] || 0) * 0.995, 0, 20);
      }
    }

    store.tokenIntents[token] = tokenMap;
  }

  store.intentCounts[analysis.intent] = clamp((store.intentCounts[analysis.intent] || 0) + 1, 0, 50000);

  if (store.lastIntent) {
    const transitions = {
      ...(store.transitions[store.lastIntent] || {}),
    };

    transitions[analysis.intent] = clamp((transitions[analysis.intent] || 0) + 1, 0, 10000);
    store.transitions[store.lastIntent] = transitions;
  }

  store.lastIntent = analysis.intent;
  store.lastUpdated = new Date().toISOString();
  writeLearningStore(store);

  if (import.meta.env.VITE_ENABLE_CHAT_LEARNING_SYNC !== 'true') return;
  if (containsSensitivePattern(normalized)) return;

  const queryLengthBucket = clamp(Math.ceil(normalized.length / 40), 1, 8);
  const atsBucket = clamp(Math.round(analysis.atsScore / 10) * 10, 10, 100);
  const flags = deriveSignalFlags(normalized);

  enqueueGlobalLearningEvent({
    intent: analysis.intent,
    atsBucket,
    keywordCount: analysis.matchedKeywords.length,
    queryLengthBucket,
    ...flags,
    replySource: signal.replySource,
    occurredAt: new Date().toISOString(),
  });

  void flushGlobalLearningQueue();
};
