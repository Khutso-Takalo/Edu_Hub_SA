type HeroMode = 'new' | 'curious' | 'returning';
type Variant = 'A' | 'B';

export type AnalyticsWindow = '7d' | '30d' | 'all';

export interface TrendPoint {
  label: string;
  rate: number;
}

type EventName =
  | 'hero_impression'
  | 'hero_search_submit'
  | 'search_suggestion_impression'
  | 'search_suggestion_click'
  | 'search_urgency_results_impression'
  | 'search_urgency_result_click';

interface MetricEvent {
  name: EventName;
  at: string;
  value: number;
  meta?: Record<string, string | number | boolean>;
}

interface AnalyticsStore {
  events: MetricEvent[];
}

export interface UiExperimentSummary {
  generatedAt: string;
  window: AnalyticsWindow;
  heroSubmitRateByMode: Array<{ mode: HeroMode; submits: number; impressions: number; rate: number }>;
  heroSubmitRateByVariant: Array<{ variant: Variant; submits: number; impressions: number; rate: number }>;
  suggestionChipCtr: {
    clicks: number;
    impressions: number;
    rate: number;
  };
  suggestionChipCtrByVariant: Array<{ variant: Variant; clicks: number; impressions: number; rate: number }>;
  urgencyResultsCtr: {
    clicks: number;
    impressions: number;
    rate: number;
  };
  urgencyResultsCtrByVariant: Array<{ variant: Variant; clicks: number; impressions: number; rate: number }>;
  trends: {
    heroSubmitRate: TrendPoint[];
    suggestionCtr: TrendPoint[];
    urgencyCtr: TrendPoint[];
  };
}

const STORAGE_KEY = 'eduhub:ui-analytics:v1';
const MAX_EVENTS = 1200;

const readStore = (): AnalyticsStore => {
  if (typeof window === 'undefined') return { events: [] };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: [] };
    const parsed = JSON.parse(raw) as AnalyticsStore;

    if (!parsed || !Array.isArray(parsed.events)) return { events: [] };
    return {
      events: parsed.events.filter((item) => typeof item?.name === 'string' && typeof item?.at === 'string'),
    };
  } catch {
    return { events: [] };
  }
};

const writeStore = (store: AnalyticsStore) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota failures in analytics paths.
  }
};

export const trackUiEvent = (
  name: EventName,
  options?: { value?: number; meta?: Record<string, string | number | boolean> }
) => {
  const store = readStore();
  const next: MetricEvent = {
    name,
    at: new Date().toISOString(),
    value: options?.value ?? 1,
    meta: options?.meta,
  };

  const events = [...store.events, next].slice(-MAX_EVENTS);
  writeStore({ events });
};

const sumValues = (events: MetricEvent[], predicate: (event: MetricEvent) => boolean) => {
  return events.reduce((acc, event) => acc + (predicate(event) ? event.value : 0), 0);
};

const toRate = (numerator: number, denominator: number) => {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
};

const getWindowDays = (window: AnalyticsWindow) => {
  if (window === '7d') return 7;
  if (window === '30d') return 30;
  return 30;
};

const formatBucketLabel = (date: Date) => {
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${day}/${month}`;
};

const filterEventsByWindow = (events: MetricEvent[], window: AnalyticsWindow) => {
  if (window === 'all') return events;

  const windowDays = window === '7d' ? 7 : 30;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  return events.filter((event) => {
    const eventTime = new Date(event.at).getTime();
    return Number.isFinite(eventTime) && eventTime >= cutoff;
  });
};

const getVariantCtr = (
  events: MetricEvent[],
  clickEvent: EventName,
  impressionEvent: EventName
): Array<{ variant: Variant; clicks: number; impressions: number; rate: number }> => {
  const variants: Variant[] = ['A', 'B'];

  return variants.map((variant) => {
    const clicks = sumValues(
      events,
      (event) => event.name === clickEvent && event.meta?.variant === variant
    );
    const impressions = sumValues(
      events,
      (event) => event.name === impressionEvent && event.meta?.variant === variant
    );

    return {
      variant,
      clicks,
      impressions,
      rate: toRate(clicks, impressions),
    };
  });
};

const buildRateTrend = (
  events: MetricEvent[],
  numeratorEvent: EventName,
  denominatorEvent: EventName,
  window: AnalyticsWindow
): TrendPoint[] => {
  const days = getWindowDays(window);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const keys = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: formatBucketLabel(date),
    };
  });

  const numerators = new Map<string, number>();
  const denominators = new Map<string, number>();

  for (const event of events) {
    const key = event.at.slice(0, 10);
    if (!keys.some((item) => item.key === key)) continue;

    if (event.name === numeratorEvent) {
      numerators.set(key, (numerators.get(key) ?? 0) + event.value);
    }

    if (event.name === denominatorEvent) {
      denominators.set(key, (denominators.get(key) ?? 0) + event.value);
    }
  }

  return keys.map((bucket) => {
    const numerator = numerators.get(bucket.key) ?? 0;
    const denominator = denominators.get(bucket.key) ?? 0;

    return {
      label: bucket.label,
      rate: toRate(numerator, denominator),
    };
  });
};

export const getUiExperimentSummary = (window: AnalyticsWindow = 'all'): UiExperimentSummary => {
  const events = filterEventsByWindow(readStore().events, window);

  const heroModes: HeroMode[] = ['new', 'curious', 'returning'];
  const heroSubmitRateByMode = heroModes.map((mode) => {
    const impressions = sumValues(events, (event) => event.name === 'hero_impression' && event.meta?.mode === mode);
    const submits = sumValues(events, (event) => event.name === 'hero_search_submit' && event.meta?.mode === mode);

    return {
      mode,
      impressions,
      submits,
      rate: toRate(submits, impressions),
    };
  });

  const variants: Variant[] = ['A', 'B'];
  const heroSubmitRateByVariant = variants.map((variant) => {
    const impressions = sumValues(
      events,
      (event) => event.name === 'hero_impression' && event.meta?.variant === variant
    );
    const submits = sumValues(
      events,
      (event) => event.name === 'hero_search_submit' && event.meta?.variant === variant
    );

    return {
      variant,
      impressions,
      submits,
      rate: toRate(submits, impressions),
    };
  });

  const suggestionImpressions = sumValues(events, (event) => event.name === 'search_suggestion_impression');
  const suggestionClicks = sumValues(events, (event) => event.name === 'search_suggestion_click');

  const urgencyImpressions = sumValues(events, (event) => event.name === 'search_urgency_results_impression');
  const urgencyClicks = sumValues(events, (event) => event.name === 'search_urgency_result_click');

  const suggestionChipCtrByVariant = getVariantCtr(
    events,
    'search_suggestion_click',
    'search_suggestion_impression'
  );

  const urgencyResultsCtrByVariant = getVariantCtr(
    events,
    'search_urgency_result_click',
    'search_urgency_results_impression'
  );

  const trends = {
    heroSubmitRate: buildRateTrend(events, 'hero_search_submit', 'hero_impression', window),
    suggestionCtr: buildRateTrend(events, 'search_suggestion_click', 'search_suggestion_impression', window),
    urgencyCtr: buildRateTrend(events, 'search_urgency_result_click', 'search_urgency_results_impression', window),
  };

  return {
    generatedAt: new Date().toISOString(),
    window,
    heroSubmitRateByMode,
    heroSubmitRateByVariant,
    suggestionChipCtr: {
      clicks: suggestionClicks,
      impressions: suggestionImpressions,
      rate: toRate(suggestionClicks, suggestionImpressions),
    },
    suggestionChipCtrByVariant,
    urgencyResultsCtr: {
      clicks: urgencyClicks,
      impressions: urgencyImpressions,
      rate: toRate(urgencyClicks, urgencyImpressions),
    },
    urgencyResultsCtrByVariant,
    trends,
  };
};

export const clearUiAnalytics = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
};
