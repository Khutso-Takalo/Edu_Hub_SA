import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Download, Upload, RefreshCw, Database, Save, Trash2, Plus, X, Flag, CheckCircle2, Wifi, CloudOff, HardDrive, Rocket, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useBursaries } from '@/hooks/useBursaries';
import { useInstitutions } from '@/hooks/useInstitutions';
import { useDatabase } from '@/contexts/DatabaseProvider';
import { WebScraperService } from '@/services/WebScraperService';
import { useDataFreshness } from '@/hooks/useDataFreshness';
import { useBursaryFlags } from '@/hooks/useBursaryFlags';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from '@/components/ui/use-toast';
import type { Application } from '@/infrastructure/database/indexeddb/schema';
import { db } from '@/infrastructure/database/indexeddb/schema';
import { getSeedAudit, type SeedAudit } from '@/infrastructure/database/indexeddb/seed';
import type { Bursary } from '@/data/staticData';
import sourceCatalog from '@/data/seed/source-catalog.json';
import type { SignUpPersonaContext, UserProfile } from '@/hooks/useAuth';
import {
  clearUiAnalytics,
  getUiExperimentSummary,
  type AnalyticsWindow,
  type TrendPoint,
  type UiExperimentSummary,
} from '@/lib/uiAnalytics';
import { buildBursaryQualitySnapshot } from '@/lib/dataHealth';
import { TRUST_TIER_LABELS } from '@/lib/dataGovernance';
import { evaluateScraperHeartbeat, type ScraperHeartbeat } from '@/lib/dataHealth';
import { DATA_SOURCE_REGISTRY, GOOGLE_DORK_QUERY_REGISTRY } from '@/lib/dataSourceRegistry';
import { getNotificationDeliveryLog, getNotificationDeliverySummary, getDeliverySloSummary, getChannelDeliverySloSummary, getDeliverySloTrend, getPersistentSloBreachStatus, getDeadLetterEntries, getActiveAlerts, getSupportTickets, evaluateNotificationAlerts, pruneOldResolvedAlerts, updateSupportTicketStatus } from '@/lib/notificationMonitoring';
import { clearNotificationReliabilityOverrides, getNotificationReliabilityConfig, setNotificationReliabilityOverrides } from '@/lib/notificationReliabilityConfig';
import { runtimeEnvStatus } from '@/lib/runtimeEnv';
import { NotificationTransport } from '@/services/NotificationTransport';
import type { Alert } from '@/lib/alerting';

interface AdminPanelProps {
  isAdmin?: boolean;
  applications: Application[];
  onImportApplications: (rows: Partial<Application>[]) => Promise<number>;
  userProfile?: UserProfile | null;
  signupPersonaContext?: SignUpPersonaContext | null;
}

interface TrendSparklineProps {
  title: string;
  currentRate: number;
  points: TrendPoint[];
  stroke: string;
  valueSuffix?: string;
  decimals?: number;
}

interface BrokenPriorityRow {
  id: string;
  name: string;
  provider: string;
  link: string;
  freshnessScore: number;
  consecutiveBrokenChecks: number;
  needsReview: boolean;
  priorityScore: number;
}

interface SourceCatalogEntry {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  layer: string;
  priority: string;
  status: 'matched' | 'fallback' | 'unreachable';
  checkedAt: string;
  matchedLinks: Array<{ url: string; text: string }>;
  keywordsUsed: string[];
  note: string;
}

const TrendSparkline: React.FC<TrendSparklineProps> = ({
  title,
  currentRate,
  points,
  stroke,
  valueSuffix = '%',
  decimals = 1,
}) => (
  <div className="rounded-md border border-gray-200 bg-white p-2">
    <div className="flex items-center justify-between mb-1">
      <p className="font-medium text-gray-800">{title}</p>
      <p className="text-gray-600">{currentRate.toFixed(decimals)}{valueSuffix}</p>
    </div>
    <div className="h-14">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as TrendPoint;

              return (
                <div className="rounded-md border border-gray-200 bg-white/95 px-2 py-1 shadow-sm text-[10px] text-gray-700">
                  <p className="font-medium text-gray-800">{point?.label || '-'}</p>
                  <p>{(point?.rate ?? 0).toFixed(decimals)}{valueSuffix}</p>
                </div>
              );
            }}
          />
          <Line type="monotone" dataKey="rate" stroke={stroke} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
      <span>{points[0]?.label || '-'}</span>
      <span>{points[points.length - 1]?.label || '-'}</span>
    </div>
  </div>
);

function formatDurationMs(ms: number) {
  if (ms <= 0) {
    return '0s';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function calculateBreakerStabilityScore(opens: number, recoveries: number) {
  const total = opens + recoveries;
  if (total === 0) {
    return 0;
  }

  return Math.round(((recoveries - opens) / total) * 100);
}

function sumTrendPoints(points: TrendPoint[]) {
  return points.reduce((acc, point) => acc + point.rate, 0);
}

const BREAKER_SCORE_TOOLTIP = 'Stability score = ((recoveries - opens) / (recoveries + opens)) x 100 over 7 days. Positive is healthier.';

const AdminPanel: React.FC<AdminPanelProps> = ({ isAdmin = true, applications, onImportApplications, userProfile, signupPersonaContext }) => {
  const { bursaries, refresh: refreshBursaries } = useBursaries({ includeHidden: true });
  const { institutions, refresh: refreshInstitutions } = useInstitutions();
  const { bursaryRepo } = useDatabase();
  const { lastUpdated, refresh: refreshFreshness } = useDataFreshness();
  const { flags, openFlags, loadFlags, resolveFlag, deleteFlag } = useBursaryFlags();
  const { isOnline, offlineReady, updateReady, canInstall, applyUpdate, promptInstall } = usePwaStatus();
  const [scraping, setScraping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Bursary | null>(null);
  const [seedAudit, setSeedAudit] = useState<SeedAudit | null>(null);
  const [seedSummary, setSeedSummary] = useState<string>('Not available');
  const [storageUsageMb, setStorageUsageMb] = useState<number | null>(null);
  const [analyticsWindow, setAnalyticsWindow] = useState<AnalyticsWindow>('30d');
  const [uiExperimentSummary, setUiExperimentSummary] = useState<UiExperimentSummary>(() => getUiExperimentSummary('30d'));
  const [scraperHeartbeats, setScraperHeartbeats] = useState<ScraperHeartbeat[]>([]);
  const [openReconciliationFlags, setOpenReconciliationFlags] = useState(0);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [alertRefreshVersion, setAlertRefreshVersion] = useState(0);
  const [reliabilityDraft, setReliabilityDraft] = useState(() => getNotificationReliabilityConfig());
  const sourceCatalogEntries = sourceCatalog as SourceCatalogEntry[];

  const notificationDeliverySummary = useMemo(() => getNotificationDeliverySummary(), []);
  const recentNotificationDeliveries = useMemo(() => getNotificationDeliveryLog(8), []);
  const deliverySloSummary = useMemo(() => getDeliverySloSummary(24), []);
  const channelDeliverySlo = useMemo(() => getChannelDeliverySloSummary(24), []);
  const deliverySloTrendOverall = useMemo(() => getDeliverySloTrend({ windows: 7, windowHours: 24, channel: 'all' }), []);
  const deliverySloTrendEmail = useMemo(() => getDeliverySloTrend({ windows: 7, windowHours: 24, channel: 'email' }), []);
  const deliverySloTrendSms = useMemo(() => getDeliverySloTrend({ windows: 7, windowHours: 24, channel: 'sms' }), []);
  const persistentSloStatus = useMemo(() => getPersistentSloBreachStatus(), []);
  const deadLetterEntries = useMemo(() => getDeadLetterEntries(5), []);
  const activeAlerts = useMemo(() => {
    evaluateNotificationAlerts(runtimeEnvStatus.isNotificationConfigured);
    pruneOldResolvedAlerts();
    return getActiveAlerts().filter((a) => !dismissedAlerts.has(a.id));
  }, [dismissedAlerts]);
  const supportTickets = useMemo(
    () => getSupportTickets(10),
    []
  );
  const openSupportTicketCount = useMemo(
    () => supportTickets.filter((ticket) => ticket.status !== 'resolved').length,
    [supportTickets]
  );
  const circuitBreakerStatusByChannel = useMemo(() => {
    const config = getNotificationReliabilityConfig();
    const now = Date.now();

    const buildChannelStatus = (channel: 'email' | 'sms') => {
      const state = NotificationTransport.getCircuitBreakerState(channel);
      const openedAt = state?.openedAt ?? null;
      const cooldownRemainingMs =
        state?.state === 'open' && openedAt !== null
          ? Math.max(0, config.circuitBreakerCooldownMs - (now - openedAt))
          : 0;

      return {
        channel,
        state: state?.state ?? 'closed',
        consecutiveFailures: state?.consecutiveFailures ?? 0,
        openedAt,
        cooldownRemainingMs,
      };
    };

    return {
      email: buildChannelStatus('email'),
      sms: buildChannelStatus('sms'),
    };
  }, []);
  const circuitBreakerIncidentSummary = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentSummary(24),
    []
  );
  const circuitBreakerOpenTrendEmail = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'email', type: 'opened', windows: 7, windowHours: 24 }),
    []
  );
  const circuitBreakerOpenTrendSms = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'sms', type: 'opened', windows: 7, windowHours: 24 }),
    []
  );
  const circuitBreakerRecoveryTrendEmail = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'email', type: 'recovered', windows: 7, windowHours: 24 }),
    []
  );
  const circuitBreakerRecoveryTrendSms = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'sms', type: 'recovered', windows: 7, windowHours: 24 }),
    []
  );
  const circuitBreakerOpenTrendEmail14 = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'email', type: 'opened', windows: 14, windowHours: 24 }),
    []
  );
  const circuitBreakerOpenTrendSms14 = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'sms', type: 'opened', windows: 14, windowHours: 24 }),
    []
  );
  const circuitBreakerRecoveryTrendEmail14 = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'email', type: 'recovered', windows: 14, windowHours: 24 }),
    []
  );
  const circuitBreakerRecoveryTrendSms14 = useMemo(
    () => NotificationTransport.getCircuitBreakerIncidentTrend({ channel: 'sms', type: 'recovered', windows: 14, windowHours: 24 }),
    []
  );
  const circuitBreakerStabilityScore = useMemo(() => {
    const emailOpens = sumTrendPoints(circuitBreakerOpenTrendEmail);
    const emailRecoveries = sumTrendPoints(circuitBreakerRecoveryTrendEmail);
    const smsOpens = sumTrendPoints(circuitBreakerOpenTrendSms);
    const smsRecoveries = sumTrendPoints(circuitBreakerRecoveryTrendSms);

    const emailPreviousOpens = sumTrendPoints(circuitBreakerOpenTrendEmail14.slice(0, 7));
    const emailPreviousRecoveries = sumTrendPoints(circuitBreakerRecoveryTrendEmail14.slice(0, 7));
    const smsPreviousOpens = sumTrendPoints(circuitBreakerOpenTrendSms14.slice(0, 7));
    const smsPreviousRecoveries = sumTrendPoints(circuitBreakerRecoveryTrendSms14.slice(0, 7));

    const buildChannelStatus = (score: number) => {
      if (score >= 20) {
        return {
          label: 'Healthy',
          className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        };
      }

      if (score <= -20) {
        return {
          label: 'Unstable',
          className: 'border-red-200 bg-red-50 text-red-700',
        };
      }

      return {
        label: 'Watch',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    };

    const emailScore = calculateBreakerStabilityScore(emailOpens, emailRecoveries);
    const smsScore = calculateBreakerStabilityScore(smsOpens, smsRecoveries);
    const emailPreviousScore = calculateBreakerStabilityScore(emailPreviousOpens, emailPreviousRecoveries);
    const smsPreviousScore = calculateBreakerStabilityScore(smsPreviousOpens, smsPreviousRecoveries);

    return {
      email: {
        opens: emailOpens,
        recoveries: emailRecoveries,
        score: emailScore,
        previousScore: emailPreviousScore,
        delta: emailScore - emailPreviousScore,
        ...buildChannelStatus(emailScore),
      },
      sms: {
        opens: smsOpens,
        recoveries: smsRecoveries,
        score: smsScore,
        previousScore: smsPreviousScore,
        delta: smsScore - smsPreviousScore,
        ...buildChannelStatus(smsScore),
      },
    };
  }, [
    circuitBreakerOpenTrendEmail,
    circuitBreakerOpenTrendSms,
    circuitBreakerRecoveryTrendEmail,
    circuitBreakerRecoveryTrendSms,
    circuitBreakerOpenTrendEmail14,
    circuitBreakerOpenTrendSms14,
    circuitBreakerRecoveryTrendEmail14,
    circuitBreakerRecoveryTrendSms14,
  ]);

  useEffect(() => {
    setReliabilityDraft(getNotificationReliabilityConfig());
  }, [alertRefreshVersion]);

  const handleSupportTicketStatus = (ticketId: string, status: 'open' | 'acknowledged' | 'resolved') => {
    const updated = updateSupportTicketStatus(ticketId, status);
    if (updated) {
      setAlertRefreshVersion((value) => value + 1);
      toast({
        title: status === 'resolved' ? 'Ticket resolved' : status === 'acknowledged' ? 'Ticket acknowledged' : 'Ticket reopened',
        description: `Support ticket ${ticketId} moved to ${status}.`,
      });
      return;
    }

    toast({
      title: 'Ticket update failed',
      description: 'Could not update the support ticket status.',
      variant: 'destructive',
    });
  };

  const saveReliabilityOverrides = () => {
    setNotificationReliabilityOverrides({
      maxAttempts: reliabilityDraft.maxAttempts,
      baseDelayMs: reliabilityDraft.baseDelayMs,
      sloTargetPercent: reliabilityDraft.sloTargetPercent,
      circuitBreakerFailureThreshold: reliabilityDraft.circuitBreakerFailureThreshold,
      circuitBreakerCooldownMs: reliabilityDraft.circuitBreakerCooldownMs,
    });

    setAlertRefreshVersion((value) => value + 1);
    toast({
      title: 'Reliability settings updated',
      description: 'Retry policy and SLO target overrides are now active.',
    });
  };

  const resetReliabilityOverrides = () => {
    clearNotificationReliabilityOverrides();
    const defaults = getNotificationReliabilityConfig();
    setReliabilityDraft(defaults);
    setAlertRefreshVersion((value) => value + 1);
    toast({
      title: 'Reliability settings reset',
      description: 'Using environment defaults for retries and SLO target.',
    });
  };

  const refreshSystemHealth = useCallback(async () => {
    const [audit, summaryRecord] = await Promise.all([
      getSeedAudit(),
      db.meta.get('seedSummary'),
    ]);

    setSeedAudit(audit);
    setSeedSummary(summaryRecord?.value || 'Not available');

    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      const usage = typeof estimate.usage === 'number' ? estimate.usage / (1024 * 1024) : null;
      setStorageUsageMb(usage);
    }

    const heartbeatRows = await db.scraperHeartbeats?.orderBy('runAt').reverse().limit(10).toArray();
    setScraperHeartbeats(heartbeatRows ?? []);

    const reconciliationCount = await db.reconciliationFlags?.where('status').equals('open').count();
    setOpenReconciliationFlags(reconciliationCount ?? 0);

    setUiExperimentSummary(getUiExperimentSummary(analyticsWindow));
  }, [analyticsWindow]);

  useEffect(() => {
    loadFlags();
    void refreshSystemHealth();
  }, [loadFlags, refreshSystemHealth]);

  const resetAnalytics = () => {
    clearUiAnalytics();
    setUiExperimentSummary(getUiExperimentSummary(analyticsWindow));
    toast({
      title: 'Experiment analytics reset',
      description: `Cleared UI analytics for the ${analyticsWindow} reporting view.`,
    });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(applications, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eduhub-applications.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows = [
      ['id', 'bursaryId', 'status', 'deadlineDate', 'updatedAt'].join(','),
      ...applications.map((item) =>
        [item.id, item.bursaryId, item.status, item.deadlineDate || '', item.updatedAt].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eduhub-applications.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = JSON.parse(text) as Partial<Application>[];
      const count = await onImportApplications(rows);
      toast({ title: 'Import complete', description: `${count} application(s) imported.` });
    } catch {
      toast({
        title: 'Import failed',
        description: 'The selected file is not a valid applications JSON export.',
        variant: 'destructive',
      });
    }
  };

  const exportBursariesJson = () => {
    const blob = new Blob([JSON.stringify(bursaries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'eduhub-bursaries.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportFeedbackJson = async () => {
    const feedbackRows = await db.feedbackEntries.orderBy('createdAt').reverse().toArray();
    const blob = new Blob([JSON.stringify(feedbackRows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eduhub-feedback-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportClassroomSnapshot = async () => {
    const [classrooms, members] = await Promise.all([
      db.classrooms.toArray(),
      db.classroomMembers.toArray(),
    ]);

    const snapshot = classrooms.map((classroom) => {
      const classroomMembers = members.filter((item) => item.classroomId === classroom.id);
      const tracked = classroomMembers.filter((member) =>
        applications.some((application) => application.userId === member.userId && application.status !== 'draft')
      ).length;

      return {
        classroomId: classroom.id,
        code: classroom.code,
        teacherName: classroom.teacherName,
        createdAt: classroom.createdAt,
        memberCount: classroomMembers.length,
        learnersWithTrackedApplications: tracked,
      };
    });

    const blob = new Blob(
      [
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            totalClassrooms: classrooms.length,
            rows: snapshot,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eduhub-classroom-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const buildHealthReportSnapshot = () => ({
    generatedAt: new Date().toISOString(),
    connectivity: {
      isOnline,
    },
    pwa: {
      offlineReady,
      updateReady,
      canInstall,
    },
    seedAudit,
    seedSummary,
    storage: {
      usageMb: storageUsageMb,
    },
    dataCounts: {
      bursaries: bursaries.length,
      institutions: institutions.length,
      applications: applications.length,
      openFlags: openFlags.length,
      openReconciliationFlags,
    },
    scraperHeartbeatStatus: evaluateScraperHeartbeat(scraperHeartbeats),
    uiExperiments: uiExperimentSummary,
  });

  const exportHealthReport = () => {
    const report = buildHealthReportSnapshot();

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eduhub-health-report-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const copyHealthReport = async () => {
    const report = buildHealthReportSnapshot();

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }

      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      toast({
        title: 'Health report copied',
        description: 'System health snapshot was copied to your clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Clipboard permission is unavailable in this environment.',
        variant: 'destructive',
      });
    }
  };

  const ensureAdminAccess = () => {
    if (isAdmin) return true;

    toast({
      title: 'Admin access required',
      description: 'This action is restricted to admin accounts.',
      variant: 'destructive',
    });
    return false;
  };

  const importBursariesJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!ensureAdminAccess()) {
      event.target.value = '';
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rows = JSON.parse(text) as Bursary[];

      if (!Array.isArray(rows)) {
        throw new Error('Invalid payload');
      }

      const validRows = rows.filter((item) => item && typeof item.id === 'string' && typeof item.name === 'string');

      if (validRows.length === 0) {
        throw new Error('No valid rows');
      }

      const now = new Date().toISOString();
      const normalized = validRows.map((item) => ({
        ...item,
        verificationSource: item.verificationSource || 'community',
        lastVerified: item.lastVerified || now,
        freshnessScore: item.freshnessScore ?? 100,
      }));

      await bursaryRepo.bulkAdd(normalized);
      await db.meta.put({
        key: 'lastSeededAt',
        value: now,
        updatedAt: now,
      });
      await db.meta.put({
        key: 'seedSummary',
        value: JSON.stringify({
          source: 'admin-import',
          imported: normalized.length,
        }),
        updatedAt: now,
      });

      await Promise.all([refreshBursaries(), refreshFreshness()]);
      await refreshSystemHealth();
      toast({ title: 'Bursaries imported', description: `${normalized.length} bursary record(s) imported.` });
    } catch {
      toast({
        title: 'Bursary import failed',
        description: 'Provide a valid bursary JSON array with id and name fields.',
        variant: 'destructive',
      });
    } finally {
      event.target.value = '';
    }
  };

  const runScrape = async () => {
    if (!ensureAdminAccess()) {
      return;
    }

    setScraping(true);
    try {
      const scraped = await WebScraperService.scrapeBursaries({
        personaProfile: {
          personaType: signupPersonaContext?.personaType,
          province: userProfile?.province || undefined,
          interests: userProfile?.career_interests || [],
          priorityKeywords:
            signupPersonaContext?.scrapeFocusKeywords?.length
              ? signupPersonaContext.scrapeFocusKeywords
              : (userProfile?.career_interests || []),
        },
      });
      await db.scraperHeartbeats?.add({
        id: `hb-${Date.now()}`,
        sourceId: 'admin-scrape',
        runAt: new Date().toISOString(),
        success: true,
        rowsScraped: scraped.length,
      });
      await bursaryRepo.bulkAdd(scraped);
      const now = new Date().toISOString();
      await db.meta.put({
        key: 'lastSeededAt',
        value: now,
        updatedAt: now,
      });
      await db.meta.put({
        key: 'seedSummary',
        value: JSON.stringify({
          source: 'admin-scrape',
          imported: scraped.length,
        }),
        updatedAt: now,
      });
      await Promise.all([refreshBursaries(), refreshFreshness()]);
      await refreshSystemHealth();
      toast({ title: 'Scrape completed', description: `${scraped.length} records reviewed and saved.` });
    } catch (error) {
      await db.scraperHeartbeats?.add({
        id: `hb-${Date.now()}`,
        sourceId: 'admin-scrape',
        runAt: new Date().toISOString(),
        success: false,
        rowsScraped: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown scrape error',
      });
      toast({ title: 'Scrape failed', description: 'Could not scrape source websites.', variant: 'destructive' });
    } finally {
      setScraping(false);
    }
  };

  const filteredBursaries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bursaries;

    return bursaries.filter((item) =>
      item.name.toLowerCase().includes(query) ||
      item.provider.toLowerCase().includes(query) ||
      item.field.toLowerCase().includes(query)
    );
  }, [bursaries, searchQuery]);

  const resetDraft = () => {
    setDraft(null);
    setEditingId(null);
  };

  const handleEdit = (bursary: Bursary) => {
    setEditingId(bursary.id);
    setDraft({ ...bursary });
  };

  const handleCreate = () => {
    const id = `local-${Date.now()}`;
    setEditingId(id);
    setDraft({
      id,
      name: '',
      provider: '',
      field: 'All Fields',
      eligibility: '',
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      amount: 'Unknown',
      link: '#',
      description: '',
      minAPS: 0,
      verificationSource: 'community',
      lastVerified: new Date().toISOString(),
      freshnessScore: 100,
      isGolden: false,
      isSponsored: false,
      sponsorName: '',
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.provider.trim()) {
      toast({
        title: 'Missing required fields',
        description: 'Name and provider are required.',
        variant: 'destructive',
      });
      return;
    }

    const payload: Bursary = {
      ...draft,
      name: draft.name.trim(),
      provider: draft.provider.trim(),
      field: draft.field.trim() || 'All Fields',
      eligibility: draft.eligibility.trim(),
      amount: draft.amount.trim(),
      link: draft.link.trim() || '#',
      description: draft.description.trim(),
      minAPS: Number.isFinite(Number(draft.minAPS)) ? Number(draft.minAPS) : 0,
      verificationSource: draft.verificationSource || 'community',
      lastVerified: draft.lastVerified || new Date().toISOString(),
      freshnessScore: draft.freshnessScore ?? 100,
      isGolden: !!draft.isGolden,
      isSponsored: !!draft.isSponsored,
      sponsorName: (draft.sponsorName || '').trim(),
    };

    await bursaryRepo.add(payload);
    await refreshBursaries();
    toast({ title: 'Bursary saved', description: `${payload.name} was saved to local data.` });
    resetDraft();
  };

  const handleDelete = async (bursary: Bursary) => {
    if (!window.confirm(`Delete ${bursary.name}?`)) return;

    await bursaryRepo.delete(bursary.id);
    await refreshBursaries();
    toast({ title: 'Bursary deleted', description: `${bursary.name} was removed from local data.` });

    if (editingId === bursary.id) {
      resetDraft();
    }
  };

  const toggleGolden = async (bursary: Bursary) => {
    await bursaryRepo.update(bursary.id, { isGolden: !bursary.isGolden });
    await refreshBursaries();
  };

  const toggleSponsored = async (bursary: Bursary) => {
    const nextSponsored = !bursary.isSponsored;
    await bursaryRepo.update(bursary.id, {
      isSponsored: nextSponsored,
      sponsorName: nextSponsored ? (bursary.sponsorName || bursary.provider) : '',
    });
    await refreshBursaries();
  };

  const stats = useMemo(
    () => [
      { label: 'Bursaries', value: bursaries.length },
      { label: 'Institutions', value: institutions.length },
      { label: 'Applications', value: applications.length },
      { label: 'Open flags', value: openFlags.length },
    ],
    [applications.length, bursaries.length, institutions.length, openFlags.length]
  );

  const qualitySnapshot = useMemo(() => buildBursaryQualitySnapshot(bursaries), [bursaries]);
  const heartbeatStatus = useMemo(() => evaluateScraperHeartbeat(scraperHeartbeats), [scraperHeartbeats]);

  const handleResolveFlag = async (id: string) => {
    const ok = await resolveFlag(id);
    if (ok) {
      toast({ title: 'Flag resolved', description: 'Report marked as resolved.' });
    }
  };

  const handleDeleteFlag = async (id: string) => {
    const ok = await deleteFlag(id);
    if (ok) {
      toast({ title: 'Flag removed', description: 'Report deleted from review queue.' });
    }
  };

  const heroAggregateRate = useMemo(() => {
    const totals = uiExperimentSummary.heroSubmitRateByVariant.reduce(
      (acc, item) => ({
        submits: acc.submits + item.submits,
        impressions: acc.impressions + item.impressions,
      }),
      { submits: 0, impressions: 0 }
    );

    if (totals.impressions === 0) return 0;
    return Number(((totals.submits / totals.impressions) * 100).toFixed(1));
  }, [uiExperimentSummary.heroSubmitRateByVariant]);

  const groupedSources = useMemo(() => {
    return DATA_SOURCE_REGISTRY.reduce<Record<string, typeof DATA_SOURCE_REGISTRY>>((acc, source) => {
      if (!acc[source.layer]) {
        acc[source.layer] = [];
      }

      acc[source.layer].push(source);
      return acc;
    }, {});
  }, []);

  const groupedQueries = useMemo(() => {
    return GOOGLE_DORK_QUERY_REGISTRY.reduce<Record<string, typeof GOOGLE_DORK_QUERY_REGISTRY>>((acc, query) => {
      if (!acc[query.category]) {
        acc[query.category] = [];
      }

      acc[query.category].push(query);
      return acc;
    }, {});
  }, []);

  const sourceCatalogSummary = useMemo(() => {
    return sourceCatalogEntries.reduce(
      (acc, entry) => {
        acc.total += 1;
        acc[entry.status] += 1;
        return acc;
      },
      { total: 0, matched: 0, fallback: 0, unreachable: 0 }
    );
  }, [sourceCatalogEntries]);

  const topBrokenLinkPriorities = useMemo<BrokenPriorityRow[]>(() => {
    return bursaries
      .filter((item) => item.linkHealthStatus === 'broken')
      .map((item) => {
        const freshnessScore = Number.isFinite(item.freshnessScore) ? Number(item.freshnessScore) : 0;
        const consecutiveBrokenChecks = Number.isFinite(item.consecutiveBrokenChecks)
          ? Number(item.consecutiveBrokenChecks)
          : 0;

        return {
          id: item.id,
          name: item.name,
          provider: item.provider,
          link: item.link,
          freshnessScore,
          consecutiveBrokenChecks,
          needsReview: !!item.needsReview,
          priorityScore: consecutiveBrokenChecks * 100 + (100 - freshnessScore),
        };
      })
      .sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        if (b.consecutiveBrokenChecks !== a.consecutiveBrokenChecks) {
          return b.consecutiveBrokenChecks - a.consecutiveBrokenChecks;
        }
        return a.freshnessScore - b.freshnessScore;
      })
      .slice(0, 5);
  }, [bursaries]);

  const copyToClipboard = async (value: string) => {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(value);
    return true;
  };

  const copyTopBrokenPriorities = async () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      totalBroken: topBrokenLinkPriorities.length,
      topBrokenLinks: topBrokenLinkPriorities.map((row, index) => ({
        rank: index + 1,
        ...row,
      })),
    };

    if (topBrokenLinkPriorities.length === 0) {
      toast({
        title: 'No broken links to copy',
        description: 'There are currently no broken-link priorities in local data.',
      });
      return;
    }

    try {
      const copied = await copyToClipboard(JSON.stringify(payload, null, 2));
      if (!copied) {
        throw new Error('Clipboard API unavailable');
      }

      toast({
        title: 'Top priorities copied',
        description: `${topBrokenLinkPriorities.length} broken-link priorities copied as JSON.`,
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Clipboard permission is unavailable in this environment.',
        variant: 'destructive',
      });
    }
  };

  const exportTopBrokenPriorities = () => {
    if (topBrokenLinkPriorities.length === 0) {
      toast({
        title: 'No broken links to export',
        description: 'There are currently no broken-link priorities in local data.',
      });
      return;
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      totalBroken: topBrokenLinkPriorities.length,
      topBrokenLinks: topBrokenLinkPriorities.map((row, index) => ({
        rank: index + 1,
        ...row,
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eduhub-broken-priority-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Top priorities exported',
      description: `${topBrokenLinkPriorities.length} broken-link priorities exported as JSON.`,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-indigo-600" /> Admin & Data Lab
        </h1>
        <p className="text-gray-600 mt-2">
          Last seeded: {lastUpdated ? new Date(lastUpdated).toLocaleString('en-ZA') : 'Unknown'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">System Health Checklist</h2>
            <p className="text-sm text-gray-600">Operational readiness signals for offline-first beta support.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => void refreshSystemHealth()}
              className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
            >
              Refresh diagnostics
            </button>
            <button
              onClick={exportHealthReport}
              className="px-3 py-2 rounded-lg border border-indigo-300 text-indigo-700 hover:bg-indigo-50 text-sm"
            >
              Export health report
            </button>
            <button
              onClick={() => void copyHealthReport()}
              className="px-3 py-2 rounded-lg border border-violet-300 text-violet-700 hover:bg-violet-50 text-sm"
            >
              Copy health JSON
            </button>
            <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
              {([
                { id: '7d', label: '7d' },
                { id: '30d', label: '30d' },
                { id: 'all', label: 'All' },
              ] as Array<{ id: AnalyticsWindow; label: string }>).map((window) => (
                <button
                  key={window.id}
                  onClick={() => setAnalyticsWindow(window.id)}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    analyticsWindow === window.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {window.label}
                </button>
              ))}
            </div>
            <button
              onClick={resetAnalytics}
              className="px-3 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-sm"
            >
              Reset UI analytics
            </button>
            {canInstall ? (
              <button
                onClick={() => void promptInstall()}
                className="px-3 py-2 rounded-lg border border-sky-300 text-sky-700 hover:bg-sky-50 text-sm"
              >
                Install app
              </button>
            ) : null}
            {updateReady ? (
              <button
                onClick={() => void applyUpdate()}
                className="px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-sm flex items-center gap-1.5"
              >
                <Rocket className="w-4 h-4" /> Apply update
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 text-sm">
          <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">Connectivity</p>
            <p className={`font-medium flex items-center gap-1.5 ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isOnline ? <Wifi className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
              {isOnline ? 'Online' : 'Offline mode'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">PWA cache</p>
            <p className={`font-medium ${offlineReady ? 'text-emerald-700' : 'text-amber-700'}`}>
              {offlineReady ? 'Offline ready' : 'Initializing'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">Seed version</p>
            <p className="font-medium text-gray-900">{seedAudit?.seedVersion || 'unknown'}</p>
            <p className="text-xs text-gray-500 mt-1">
              {seedAudit?.lastSeededAt ? new Date(seedAudit.lastSeededAt).toLocaleString('en-ZA') : 'Never seeded'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">Storage usage</p>
            <p className="font-medium text-gray-900 flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              {storageUsageMb === null ? 'Unavailable' : `${storageUsageMb.toFixed(1)} MB`}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-1">UI experiment CTR</p>
            <p className="font-medium text-gray-900">
              Suggestions {uiExperimentSummary.suggestionChipCtr.rate}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Urgency {uiExperimentSummary.urgencyResultsCtr.rate}%
            </p>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-700 mb-1">Seed summary</p>
          <p className="break-words">{seedSummary}</p>
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-700 mb-2">Data quality snapshot</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Average freshness</p>
              <p className="font-medium text-gray-900">{qualitySnapshot.averageFreshness}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Auto-hidden candidates</p>
              <p className="font-medium text-gray-900">{qualitySnapshot.autoHiddenCount}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Broken links</p>
              <p className="font-medium text-gray-900">{qualitySnapshot.brokenLinks}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Completeness</p>
              <p className="font-medium text-gray-900">{qualitySnapshot.completenessPct}%</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {Object.entries(qualitySnapshot.trustCounts).map(([tier, count]) => (
              <div key={tier} className="rounded-md border border-gray-200 bg-white p-2">
                <p className="text-gray-500">{TRUST_TIER_LABELS[tier as keyof typeof TRUST_TIER_LABELS]}</p>
                <p className="font-medium text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-medium text-gray-700">Top Broken Links (Priority)</p>
            <div className="flex items-center gap-2">
              <button
                onClick={exportTopBrokenPriorities}
                className="px-2 py-1 rounded border border-gray-300 text-[11px] text-gray-700 hover:bg-gray-100"
              >
                Export top priorities
              </button>
              <button
                onClick={() => void copyTopBrokenPriorities()}
                className="px-2 py-1 rounded border border-gray-300 text-[11px] text-gray-700 hover:bg-gray-100"
              >
                Copy top priorities
              </button>
            </div>
          </div>
          {topBrokenLinkPriorities.length === 0 ? (
            <p className="text-gray-500">No broken links detected in local bursary records.</p>
          ) : (
            <div className="space-y-2">
              {topBrokenLinkPriorities.map((row, index) => (
                <div key={row.id} className="rounded-md border border-gray-200 bg-white p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">#{index + 1} {row.name}</p>
                      <p className="text-gray-500">{row.provider}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">P{row.priorityScore}</p>
                      <p className="text-gray-500">Score</p>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-700">
                      Freshness {row.freshnessScore}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-700">
                      Broken checks {row.consecutiveBrokenChecks}
                    </span>
                    {row.needsReview ? (
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-700">
                        Needs review
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={row.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    {row.link}
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-700 mb-2">Scraper heartbeat status</p>
          {heartbeatStatus.length === 0 ? (
            <p className="text-gray-500">No heartbeat records yet. Run scraper once to initialize tracking.</p>
          ) : (
            <div className="space-y-2">
              {heartbeatStatus.map((status) => (
                <div key={status.sourceId} className="rounded-md border border-gray-200 bg-white p-2">
                  <p className="font-medium text-gray-800">
                    {status.sourceId} - {status.status}
                  </p>
                  {status.reasons.length > 0 ? (
                    <ul className="list-disc ml-4 mt-1">
                      {status.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No failure alerts.</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-gray-700">Open reconciliation flags: {openReconciliationFlags}</p>
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-medium text-gray-700">System alerts</p>
            {activeAlerts.length > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${activeAlerts.some((a) => a.severity === 'critical') ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                {activeAlerts.some((a) => a.severity === 'critical') ? (
                  <AlertCircle size={12} />
                ) : (
                  <AlertTriangle size={12} />
                )}
                {activeAlerts.length} active {activeAlerts.length === 1 ? 'alert' : 'alerts'}
              </span>
            )}
          </div>
          {activeAlerts.length === 0 ? (
            <p className="text-gray-700">No active alerts.</p>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert) => (
                <div key={alert.id} className={`rounded-md border p-2 ${alert.severity === 'critical' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`font-medium ${alert.severity === 'critical' ? 'text-red-900' : 'text-amber-900'}`}>{alert.title}</p>
                      <p className={alert.severity === 'critical' ? 'text-red-800' : 'text-amber-800'}>{alert.message}</p>
                    </div>
                    <button
                      onClick={() => setDismissedAlerts((prev) => new Set([...prev, alert.id]))}
                      className="text-gray-400 hover:text-gray-600"
                      title="Dismiss alert"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-medium text-gray-700">Support escalation queue</p>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${openSupportTicketCount > 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {openSupportTicketCount} open {openSupportTicketCount === 1 ? 'ticket' : 'tickets'}
            </span>
          </div>
          {supportTickets.length === 0 ? (
            <p className="text-gray-700">No support escalation tickets found.</p>
          ) : (
            <div className="space-y-2">
              {supportTickets.map((ticket) => (
                <div key={ticket.id} className="rounded-md border border-red-100 bg-white p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{ticket.summary}</p>
                      <p className="text-gray-600">{ticket.details}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
                        <span
                          className={`inline-flex items-center rounded-full border px-1.5 py-0.5 ${
                            ticket.status === 'resolved'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : ticket.status === 'acknowledged'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          {ticket.status}
                        </span>
                        <span className="text-gray-500">{ticket.id}</span>
                        <span className="text-gray-500">{ticket.alertType}</span>
                        <span className="text-gray-500">{new Date(ticket.createdAt).toLocaleString('en-ZA')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {ticket.status === 'open' ? (
                        <button
                          onClick={() => handleSupportTicketStatus(ticket.id, 'acknowledged')}
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-100"
                        >
                          Acknowledge
                        </button>
                      ) : null}
                      {ticket.status !== 'resolved' ? (
                        <button
                          onClick={() => handleSupportTicketStatus(ticket.id, 'resolved')}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-800 hover:bg-emerald-100"
                        >
                          Resolve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSupportTicketStatus(ticket.id, 'open')}
                          className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-800 hover:bg-blue-100"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                  <details className="mt-2 rounded border border-gray-200 bg-gray-50 p-2">
                    <summary className="cursor-pointer text-[11px] font-medium text-gray-700">
                      Timeline ({ticket.timeline?.length || 0} events)
                    </summary>
                    <div className="mt-2 space-y-1">
                      {(ticket.timeline || []).slice().reverse().map((event) => (
                        <div key={event.id} className="rounded border border-gray-200 bg-white px-2 py-1">
                          <p className="text-[10px] font-medium text-gray-800">
                            {event.type.replace('_', ' ')} • {event.actor}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {new Date(event.createdAt).toLocaleString('en-ZA')} • status {event.status}
                          </p>
                          {event.note ? <p className="text-[10px] text-gray-600">{event.note}</p> : null}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-medium text-gray-700">Notification delivery monitoring</p>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${runtimeEnvStatus.isNotificationConfigured ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {runtimeEnvStatus.isNotificationConfigured ? 'Configured' : 'Not configured'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Delivered</p>
              <p className="font-medium text-gray-900">{notificationDeliverySummary.sent}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Failed</p>
              <p className="font-medium text-gray-900">{notificationDeliverySummary.failed}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Skipped</p>
              <p className="font-medium text-gray-900">{notificationDeliverySummary.skipped}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Last sent</p>
              <p className="font-medium text-gray-900">{notificationDeliverySummary.lastSentAt ? new Date(notificationDeliverySummary.lastSentAt).toLocaleString('en-ZA') : 'None yet'}</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">In-app</p>
              <p className="font-medium text-gray-900">{notificationDeliverySummary.byChannel['in-app']}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{notificationDeliverySummary.byChannel.email}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">SMS</p>
              <p className="font-medium text-gray-900">{notificationDeliverySummary.byChannel.sms}</p>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-gray-200 bg-white p-2">
            <p className="text-gray-500">Recent delivery audit</p>
            {recentNotificationDeliveries.length === 0 ? (
              <p className="text-gray-700 mt-1">No delivery events recorded yet.</p>
            ) : (
              <div className="mt-1 space-y-1">
                {recentNotificationDeliveries.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{item.title}</p>
                      <p className="text-gray-500">{item.channel} • {item.status} • {item.createdAt}</p>
                    </div>
                    <p className="text-gray-500 max-w-[14rem] text-right truncate">{item.details || item.provider || 'local'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className={`rounded-md border p-2 ${deliverySloSummary.isBreaching ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
              <p className="text-gray-500">24h delivery SLO</p>
              <p className={`font-medium ${deliverySloSummary.isBreaching ? 'text-red-800' : 'text-emerald-800'}`}>
                {deliverySloSummary.availability}% (target {deliverySloSummary.target}%)
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                Breach streak: {persistentSloStatus.consecutiveBreaches}/{persistentSloStatus.requiredConsecutiveWindows} windows
              </p>
              <p className="text-[10px] text-gray-500">
                Recovery streak: {persistentSloStatus.consecutiveHealthy}/{persistentSloStatus.requiredHealthyWindows} healthy windows
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">24h delivery volume</p>
              <p className="font-medium text-gray-900">{deliverySloSummary.total}</p>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="text-gray-500">Dead-letter queue</p>
              <p className="font-medium text-gray-900">{deadLetterEntries.length} recent</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={`rounded-md border p-2 ${channelDeliverySlo.email.isBreaching ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
              <p className="text-gray-500">Email SLO (24h)</p>
              <p className={`font-medium ${channelDeliverySlo.email.isBreaching ? 'text-red-800' : 'text-emerald-800'}`}>
                {channelDeliverySlo.email.availability}% ({channelDeliverySlo.email.delivered}/{Math.max(1, channelDeliverySlo.email.total)} delivered)
              </p>
            </div>
            <div className={`rounded-md border p-2 ${channelDeliverySlo.sms.isBreaching ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}>
              <p className="text-gray-500">SMS SLO (24h)</p>
              <p className={`font-medium ${channelDeliverySlo.sms.isBreaching ? 'text-red-800' : 'text-emerald-800'}`}>
                {channelDeliverySlo.sms.availability}% ({channelDeliverySlo.sms.delivered}/{Math.max(1, channelDeliverySlo.sms.total)} delivered)
              </p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-2">
            <TrendSparkline
              title="Delivery SLO trend"
              currentRate={deliverySloSummary.availability}
              points={deliverySloTrendOverall}
              stroke="#0ea5e9"
            />
            <TrendSparkline
              title="Email SLO trend"
              currentRate={channelDeliverySlo.email.availability}
              points={deliverySloTrendEmail}
              stroke="#10b981"
            />
            <TrendSparkline
              title="SMS SLO trend"
              currentRate={channelDeliverySlo.sms.availability}
              points={deliverySloTrendSms}
              stroke="#f97316"
            />
          </div>
          <div className="mt-2 rounded-md border border-gray-200 bg-white p-2">
            <p className="text-gray-500">Dead-letter failures (last 5)</p>
            {deadLetterEntries.length === 0 ? (
              <p className="text-gray-700 mt-1">No dead-letter entries.</p>
            ) : (
              <div className="mt-1 space-y-1">
                {deadLetterEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{entry.title}</p>
                      <p className="text-gray-500">{entry.channel} • attempts:{entry.attempts} • {entry.createdAt}</p>
                    </div>
                    <p className="text-gray-500 max-w-[14rem] text-right truncate">{entry.error}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2 rounded-md border border-gray-200 bg-white p-2">
            <p className="text-gray-500 mb-2">Circuit breaker status</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[circuitBreakerStatusByChannel.email, circuitBreakerStatusByChannel.sms].map((item) => (
                <div key={item.channel} className="rounded border border-gray-200 bg-gray-50 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 uppercase">{item.channel}</p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${
                        item.state === 'open'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : item.state === 'half-open'
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {item.state}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1">
                    Consecutive failures: {item.consecutiveFailures}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Opened at: {item.openedAt ? new Date(item.openedAt).toLocaleString('en-ZA') : 'N/A'}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Cooldown remaining: {formatDurationMs(item.cooldownRemainingMs)}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">
                    Incidents (24h): {item.channel === 'email' ? circuitBreakerIncidentSummary.email.openedCount : circuitBreakerIncidentSummary.sms.openedCount} opens / {item.channel === 'email' ? circuitBreakerIncidentSummary.email.recoveredCount : circuitBreakerIncidentSummary.sms.recoveredCount} recoveries
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Last open: {item.channel === 'email'
                      ? (circuitBreakerIncidentSummary.email.lastOpenedAt
                          ? new Date(circuitBreakerIncidentSummary.email.lastOpenedAt).toLocaleString('en-ZA')
                          : 'N/A')
                      : (circuitBreakerIncidentSummary.sms.lastOpenedAt
                          ? new Date(circuitBreakerIncidentSummary.sms.lastOpenedAt).toLocaleString('en-ZA')
                          : 'N/A')}
                  </p>
                  <p className="text-[10px] text-gray-600">
                    Last recovery: {item.channel === 'email'
                      ? (circuitBreakerIncidentSummary.email.lastRecoveredAt
                          ? new Date(circuitBreakerIncidentSummary.email.lastRecoveredAt).toLocaleString('en-ZA')
                          : 'N/A')
                      : (circuitBreakerIncidentSummary.sms.lastRecoveredAt
                          ? new Date(circuitBreakerIncidentSummary.sms.lastRecoveredAt).toLocaleString('en-ZA')
                          : 'N/A')}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
              <TrendSparkline
                title="Email breaker opens (7d)"
                currentRate={circuitBreakerOpenTrendEmail[circuitBreakerOpenTrendEmail.length - 1]?.rate || 0}
                points={circuitBreakerOpenTrendEmail}
                stroke="#dc2626"
                valueSuffix=""
                decimals={0}
              />
              <TrendSparkline
                title="SMS breaker opens (7d)"
                currentRate={circuitBreakerOpenTrendSms[circuitBreakerOpenTrendSms.length - 1]?.rate || 0}
                points={circuitBreakerOpenTrendSms}
                stroke="#f97316"
                valueSuffix=""
                decimals={0}
              />
              <TrendSparkline
                title="Email breaker recoveries (7d)"
                currentRate={circuitBreakerRecoveryTrendEmail[circuitBreakerRecoveryTrendEmail.length - 1]?.rate || 0}
                points={circuitBreakerRecoveryTrendEmail}
                stroke="#16a34a"
                valueSuffix=""
                decimals={0}
              />
              <TrendSparkline
                title="SMS breaker recoveries (7d)"
                currentRate={circuitBreakerRecoveryTrendSms[circuitBreakerRecoveryTrendSms.length - 1]?.rate || 0}
                points={circuitBreakerRecoveryTrendSms}
                stroke="#15803d"
                valueSuffix=""
                decimals={0}
              />
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded border border-gray-200 bg-gray-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-gray-900">Email stability score (7d)</p>
                    <span title={BREAKER_SCORE_TOOLTIP} aria-label="Email stability score formula" className="text-gray-500 cursor-help">
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${circuitBreakerStabilityScore.email.className}`}>
                    {circuitBreakerStabilityScore.email.label}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">{circuitBreakerStabilityScore.email.score}</p>
                <p className="text-[10px] text-gray-600">
                  Recoveries: {circuitBreakerStabilityScore.email.recoveries} • Opens: {circuitBreakerStabilityScore.email.opens}
                </p>
                <p className={`text-[10px] ${circuitBreakerStabilityScore.email.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  vs prev 7d: {circuitBreakerStabilityScore.email.delta >= 0 ? '+' : ''}{circuitBreakerStabilityScore.email.delta}
                </p>
              </div>
              <div className="rounded border border-gray-200 bg-gray-50 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-gray-900">SMS stability score (7d)</p>
                    <span title={BREAKER_SCORE_TOOLTIP} aria-label="SMS stability score formula" className="text-gray-500 cursor-help">
                      <Info className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${circuitBreakerStabilityScore.sms.className}`}>
                    {circuitBreakerStabilityScore.sms.label}
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900">{circuitBreakerStabilityScore.sms.score}</p>
                <p className="text-[10px] text-gray-600">
                  Recoveries: {circuitBreakerStabilityScore.sms.recoveries} • Opens: {circuitBreakerStabilityScore.sms.opens}
                </p>
                <p className={`text-[10px] ${circuitBreakerStabilityScore.sms.delta >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  vs prev 7d: {circuitBreakerStabilityScore.sms.delta >= 0 ? '+' : ''}{circuitBreakerStabilityScore.sms.delta}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-2 rounded-md border border-gray-200 bg-white p-2">
            <p className="text-gray-500 mb-2">Reliability tuning (local override)</p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <label className="text-[11px] text-gray-600">
                Retry attempts
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={reliabilityDraft.maxAttempts}
                  onChange={(event) =>
                    setReliabilityDraft((prev) => ({
                      ...prev,
                      maxAttempts: Number(event.target.value || prev.maxAttempts),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-[11px] text-gray-600">
                Base delay (ms)
                <input
                  type="number"
                  min={100}
                  max={10000}
                  step={100}
                  value={reliabilityDraft.baseDelayMs}
                  onChange={(event) =>
                    setReliabilityDraft((prev) => ({
                      ...prev,
                      baseDelayMs: Number(event.target.value || prev.baseDelayMs),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-[11px] text-gray-600">
                SLO target (%)
                <input
                  type="number"
                  min={90}
                  max={100}
                  step={0.1}
                  value={reliabilityDraft.sloTargetPercent}
                  onChange={(event) =>
                    setReliabilityDraft((prev) => ({
                      ...prev,
                      sloTargetPercent: Number(event.target.value || prev.sloTargetPercent),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-[11px] text-gray-600">
                Breaker threshold
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={reliabilityDraft.circuitBreakerFailureThreshold}
                  onChange={(event) =>
                    setReliabilityDraft((prev) => ({
                      ...prev,
                      circuitBreakerFailureThreshold: Number(event.target.value || prev.circuitBreakerFailureThreshold),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-[11px] text-gray-600">
                Breaker cooldown (ms)
                <input
                  type="number"
                  min={1000}
                  max={600000}
                  step={1000}
                  value={reliabilityDraft.circuitBreakerCooldownMs}
                  onChange={(event) =>
                    setReliabilityDraft((prev) => ({
                      ...prev,
                      circuitBreakerCooldownMs: Number(event.target.value || prev.circuitBreakerCooldownMs),
                    }))
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                />
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={saveReliabilityOverrides}
                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-800 hover:bg-blue-100"
              >
                Save overrides
              </button>
              <button
                onClick={resetReliabilityOverrides}
                className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-700 hover:bg-gray-100"
              >
                Reset to defaults
              </button>
            </div>
          </div>
          <p className="mt-2 text-gray-700">Open reconciliation flags: {openReconciliationFlags}</p>
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-700 mb-1">Hero submit rate by mode</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {uiExperimentSummary.heroSubmitRateByMode.map((item) => (
              <div key={item.mode} className="rounded-md border border-gray-200 bg-white p-2">
                <p className="font-medium capitalize text-gray-800">{item.mode}</p>
                <p>{item.rate}% ({item.submits}/{item.impressions})</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-700 mb-1">Variant split ({uiExperimentSummary.window})</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="font-medium text-gray-800 mb-1">Hero submit rate</p>
              {uiExperimentSummary.heroSubmitRateByVariant.map((item) => (
                <p key={item.variant}>
                  Variant {item.variant}: {item.rate}% ({item.submits}/{item.impressions})
                </p>
              ))}
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="font-medium text-gray-800 mb-1">Suggestion CTR</p>
              {uiExperimentSummary.suggestionChipCtrByVariant.map((item) => (
                <p key={item.variant}>
                  Variant {item.variant}: {item.rate}% ({item.clicks}/{item.impressions})
                </p>
              ))}
            </div>

            <div className="rounded-md border border-gray-200 bg-white p-2">
              <p className="font-medium text-gray-800 mb-1">Urgency CTR</p>
              {uiExperimentSummary.urgencyResultsCtrByVariant.map((item) => (
                <p key={item.variant}>
                  Variant {item.variant}: {item.rate}% ({item.clicks}/{item.impressions})
                </p>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-700 mb-2">Trend sparklines ({uiExperimentSummary.window})</p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <TrendSparkline
              title="Hero submit rate"
              currentRate={heroAggregateRate}
              points={uiExperimentSummary.trends.heroSubmitRate}
              stroke="#4f46e5"
            />
            <TrendSparkline
              title="Suggestion CTR"
              currentRate={uiExperimentSummary.suggestionChipCtr.rate}
              points={uiExperimentSummary.trends.suggestionCtr}
              stroke="#0ea5e9"
            />
            <TrendSparkline
              title="Urgency CTR"
              currentRate={uiExperimentSummary.urgencyResultsCtr.rate}
              points={uiExperimentSummary.trends.urgencyCtr}
              stroke="#f59e0b"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" /> Bursary Data Operations
          </h2>
          <div className="space-y-3">
            <button
              onClick={runScrape}
              disabled={scraping}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${scraping ? 'animate-spin' : ''}`} />
              {scraping ? 'Scraping sources...' : 'Run Bursary Scraper'}
            </button>
            <button
              onClick={exportBursariesJson}
              className="w-full px-4 py-2.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Export Bursaries (JSON)
            </button>
            <label className="w-full px-4 py-2.5 rounded-lg bg-indigo-100 text-indigo-800 hover:bg-indigo-200 flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Import Bursaries (JSON)
              <input type="file" accept="application/json" className="hidden" onChange={importBursariesJson} />
            </label>
            <button
              onClick={refreshBursaries}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Refresh Bursary Cache
            </button>
            <button
              onClick={refreshInstitutions}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Refresh Institution Cache
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Application Backup & Restore</h2>
          <div className="space-y-3">
            <button onClick={exportJson} className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Export Applications (JSON)
            </button>
            <button onClick={exportCsv} className="w-full px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-2">
              <Download className="w-4 h-4" /> Export Applications (CSV)
            </button>
            <label className="w-full px-4 py-2.5 rounded-lg bg-orange-100 text-orange-800 hover:bg-orange-200 flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Import Applications (JSON)
              <input type="file" accept="application/json" className="hidden" onChange={importJson} />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Feedback & Classroom Insights Export</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => void exportFeedbackJson()}
            className="px-4 py-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Feedback (JSON)
          </button>
          <button
            onClick={() => void exportClassroomSnapshot()}
            className="px-4 py-2.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Classroom Snapshot (JSON)
          </button>
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Bursary Records</h2>

        <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Source Discovery Registry</h2>
              <p className="text-sm text-gray-600">Static source list plus curated Google dork queries for admin-led discovery.</p>
            </div>
            <div className="text-sm text-gray-500">
              {DATA_SOURCE_REGISTRY.length} sources • {GOOGLE_DORK_QUERY_REGISTRY.length} queries
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">Registered sources</h3>
              <div className="space-y-3 max-h-[28rem] overflow-auto pr-1">
                {Object.entries(groupedSources).map(([layer, sources]) => (
                  <div key={layer} className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{layer}</p>
                    <div className="space-y-2">
                      {sources.map((source) => (
                        <div key={source.id} className="rounded-md border border-gray-100 p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{source.name}</p>
                              <p className="text-xs text-gray-500 break-all">{source.url}</p>
                            </div>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">
                              {source.priority}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-2">{source.strategy}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-3">Google dork registry</h3>
              <div className="space-y-3 max-h-[28rem] overflow-auto pr-1">
                {Object.entries(groupedQueries).map(([category, queries]) => (
                  <div key={category} className="rounded-lg border border-gray-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">{category}</p>
                    <div className="space-y-2">
                      {queries.map((query) => (
                        <div key={query.id} className="rounded-md border border-gray-100 p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-gray-900">{query.title}</p>
                              <p className="text-xs text-gray-600 mt-1 break-words">{query.query}</p>
                            </div>
                            <button
                              onClick={() => void copyToClipboard(query.query)}
                              className="shrink-0 px-2 py-1 rounded border border-gray-300 text-[11px] text-gray-700 hover:bg-gray-50"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">{query.purpose}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 xl:col-span-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Server-side source catalog</h3>
                  <p className="text-xs text-gray-600">Weekly Node scraper output used to verify which registry sources are matched, falling back, or unreachable.</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-gray-700">
                  <span className="px-2 py-1 rounded-full bg-white border border-gray-200">Total {sourceCatalogSummary.total}</span>
                  <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">Matched {sourceCatalogSummary.matched}</span>
                  <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Fallback {sourceCatalogSummary.fallback}</span>
                  <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">Unreachable {sourceCatalogSummary.unreachable}</span>
                </div>
              </div>

              <div className="space-y-2 max-h-[24rem] overflow-auto pr-1">
                {sourceCatalogEntries.map((entry) => (
                  <div key={entry.sourceId} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900">{entry.sourceName}</p>
                          <span className={`text-[10px] px-2 py-1 rounded-full capitalize border ${entry.status === 'matched' ? 'bg-green-50 text-green-700 border-green-200' : entry.status === 'fallback' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                            {entry.status}
                          </span>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize border border-gray-200">
                            {entry.priority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 break-all mt-1">{entry.sourceUrl}</p>
                      </div>
                      <div className="text-xs text-gray-500">
                        {entry.matchedLinks.length} link(s) • {entry.layer}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{entry.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
            <p className="text-sm text-gray-600">View, edit, delete, or add bursaries in IndexedDB.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search bursaries"
              aria-label="Search bursary records"
              className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
            <button
              onClick={handleCreate}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New bursary
            </button>
          </div>
        </div>

        {draft ? (
          <div className="mb-4 p-3 rounded-xl border border-indigo-200 bg-indigo-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Name"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <input
                value={draft.provider}
                onChange={(event) => setDraft({ ...draft, provider: event.target.value })}
                placeholder="Provider"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <input
                value={draft.field}
                onChange={(event) => setDraft({ ...draft, field: event.target.value })}
                placeholder="Field"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <input
                type="date"
                value={draft.deadline}
                onChange={(event) => setDraft({ ...draft, deadline: event.target.value })}
                aria-label="Bursary deadline"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <input
                value={draft.amount}
                onChange={(event) => setDraft({ ...draft, amount: event.target.value })}
                placeholder="Amount"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <input
                value={String(draft.minAPS ?? 0)}
                onChange={(event) => setDraft({ ...draft, minAPS: Number(event.target.value || 0) })}
                type="number"
                min={0}
                max={50}
                placeholder="Min APS"
                className="px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <input
                value={draft.link}
                onChange={(event) => setDraft({ ...draft, link: event.target.value })}
                placeholder="Link"
                className="md:col-span-2 px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <input
                value={draft.eligibility}
                onChange={(event) => setDraft({ ...draft, eligibility: event.target.value })}
                placeholder="Eligibility"
                className="md:col-span-2 px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <textarea
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Description"
                rows={3}
                className="md:col-span-2 px-3 py-2 rounded border border-gray-300 text-sm"
              />
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!draft.isGolden}
                  onChange={(event) => setDraft({ ...draft, isGolden: event.target.checked })}
                />
                Mark as Golden 50
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={!!draft.isSponsored}
                  onChange={(event) => setDraft({ ...draft, isSponsored: event.target.checked })}
                />
                Sponsored bursary
              </label>
              {draft.isSponsored ? (
                <input
                  value={draft.sponsorName || ''}
                  onChange={(event) => setDraft({ ...draft, sponsorName: event.target.value })}
                  placeholder="Sponsor name"
                  className="md:col-span-2 px-3 py-2 rounded border border-gray-300 text-sm"
                />
              ) : null}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleSave}
                className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> Save bursary
              </button>
              <button
                onClick={resetDraft}
                className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Provider</th>
                <th className="py-2 pr-3">Field</th>
                <th className="py-2 pr-3">Deadline</th>
                <th className="py-2 pr-3">Curation</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBursaries.map((bursary) => (
                <tr key={bursary.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-900">{bursary.name}</td>
                  <td className="py-2 pr-3 text-gray-700">{bursary.provider}</td>
                  <td className="py-2 pr-3 text-gray-700">{bursary.field}</td>
                  <td className="py-2 pr-3 text-gray-700">{bursary.deadline}</td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void toggleGolden(bursary)}
                        className={`px-2 py-1 rounded border text-xs ${bursary.isGolden ? 'border-emerald-300 text-emerald-700 bg-emerald-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >
                        {bursary.isGolden ? 'Golden' : 'Set Golden'}
                      </button>
                      <button
                        onClick={() => void toggleSponsored(bursary)}
                        className={`px-2 py-1 rounded border text-xs ${bursary.isSponsored ? 'border-indigo-300 text-indigo-700 bg-indigo-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                      >
                        {bursary.isSponsored ? 'Sponsored' : 'Set Sponsor'}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleEdit(bursary)}
                        className="px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void handleDelete(bursary)}
                        className="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBursaries.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No bursaries found for this filter.</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Flag className="w-5 h-5 text-amber-700" /> Community Flag Queue
            </h2>
            <p className="text-sm text-gray-600">Review user-reported bursary records and resolve outdated entries.</p>
          </div>
          <button
            onClick={() => loadFlags()}
            className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Refresh flags
          </button>
        </div>

        {flags.length === 0 ? (
          <p className="text-sm text-gray-500">No community reports yet.</p>
        ) : (
          <div className="space-y-3">
            {flags.map((flag) => (
              <div key={flag.id} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{flag.bursaryName}</p>
                    <p className="text-xs text-gray-600 mt-1">Reason: {flag.reason}</p>
                    {flag.details ? <p className="text-xs text-gray-600 mt-1">Details: {flag.details}</p> : null}
                    <p className="text-xs text-gray-500 mt-1">Reported: {new Date(flag.createdAt).toLocaleString('en-ZA')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        flag.status === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {flag.status}
                    </span>
                    {flag.status === 'open' ? (
                      <button
                        onClick={() => void handleResolveFlag(flag.id)}
                        className="px-2.5 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                      </button>
                    ) : null}
                    <button
                      onClick={() => void handleDeleteFlag(flag.id)}
                      className="px-2.5 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
