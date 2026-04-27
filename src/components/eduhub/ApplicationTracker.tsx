import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileCheck2,
  Filter,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Upload,
  BellPlus,
  CheckSquare,
  BellRing,
  Save,
  Trash2,
} from 'lucide-react';
import type { Application, NotificationRecord } from '@/infrastructure/database/indexeddb/schema';
import { useBursaries } from '@/hooks/useBursaries';
import { toast } from '@/components/ui/use-toast';
import KnowledgeCards from '@/components/eduhub/KnowledgeCards';

interface ApplicationTrackerProps {
  applications: Application[];
  onUpdateApplicationStatus: (id: string, status: Application['status']) => Promise<void>;
  onToggleChecklistItem: (id: string, key: 'idCopy' | 'transcript' | 'motivationLetter' | 'references') => Promise<void>;
  onRemoveApplication: (id: string) => Promise<void>;
  onUpdateApplicationNotes: (id: string, notes?: string) => Promise<void>;
  onImportApplications: (rows: Partial<Application>[]) => Promise<number>;
  onCreateReminder: (input: { applicationId: string; dueDate: string; title?: string; message?: string }) => Promise<void>;
  reminders: NotificationRecord[];
  onUpdateReminder: (id: string, input: { dueDate?: string; title?: string; message?: string }) => Promise<void>;
  onCancelReminder: (id: string) => Promise<void>;
}

type DeadlineFilter = 'all' | 'overdue' | 'today' | '7d' | '30d' | 'none';
type SortOption = 'deadline-asc' | 'deadline-desc' | 'updated-desc' | 'updated-asc' | 'status' | 'name';
type ArchiveSortOption = 'dismissed-desc' | 'dismissed-asc' | 'source-desc' | 'source-asc';
type ArchiveAnalyticsWindow = '7d' | '30d' | 'all';
interface FilterPreset {
  id: string;
  name: string;
  searchQuery: string;
  statusFilter: 'all' | Application['status'];
  deadlineFilter: DeadlineFilter;
  sortBy: SortOption;
}

const PAGE_SIZE = 6;
const SOFT_DELETE_WINDOW_MS = 8000;
const FILTER_PRESETS_STORAGE_KEY = 'eduhub:tracker-filter-presets:v1';
const TRACKER_TRENDS_STORAGE_KEY = 'eduhub:tracker-trends:v1';
const AUTOMATION_MODE_STORAGE_KEY = 'eduhub:tracker-automation-mode:v1';
const AUTOMATION_AUDIT_STORAGE_KEY = 'eduhub:tracker-automation-audit:v1';
const GOAL_HISTORY_STORAGE_KEY = 'eduhub:tracker-goal-history:v1';
const DAILY_TASK_QUEUE_STORAGE_KEY = 'eduhub:tracker-daily-task-queue:v1';
const DISMISSED_BACKLOG_ARCHIVE_STORAGE_KEY = 'eduhub:tracker-dismissed-backlog-archive:v1';
const AUDIT_PAGE_SIZE = 5;
const ARCHIVE_PAGE_SIZE = 3;
const HISTORY_EXPORT_MIME = 'application/json;charset=utf-8;';

interface TrackerTrendSnapshot {
  date: string;
  activeCount: number;
  overdueCount: number;
  dueIn7DaysCount: number;
  averageChecklistPct: number;
}

interface DailyGoalRecord {
  date: string;
  completed: number;
  target: number;
}

interface DailyTaskQueueItem {
  id: string;
  applicationId: string;
  bursaryName: string;
  label: string;
  status: 'pending' | 'done' | 'skipped';
  priorityScore: number;
  carryOver: boolean;
}

interface GoalTrendPoint {
  date: string;
  completed: number;
  target: number;
  pct: number;
}

interface DailyHistoryExport {
  goalHistory: DailyGoalRecord[];
  dailyTaskQueueByDate: Record<string, DailyTaskQueueItem[]>;
}

interface DismissedBacklogArchiveEntry {
  id: string;
  dismissedAt: string;
  sourceDate: string;
  items: DailyTaskQueueItem[];
}

interface BacklogBucket {
  label: string;
  count: number;
}

interface WeeklyPlanItem {
  id: string;
  applicationId: string;
  bursaryName: string;
  actionLabel: string;
  urgencyLabel: string;
  sortScore: number;
}

type AutomationMode = 'assisted' | 'manual';
type AuditTimeWindow = '7d' | '30d' | 'all';

interface AutomationAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  targetLabel: string;
  reason: string;
}

interface AutomationSuggestion {
  label: string;
  buttonText: string;
  run: (application: Application) => Promise<void>;
}

const checklistItems = [
  { key: 'idCopy', label: 'ID Copy' },
  { key: 'transcript', label: 'Transcript' },
  { key: 'motivationLetter', label: 'Motivation Letter' },
  { key: 'references', label: 'References' },
] as const;

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
    reader.readAsText(file);
  });
}

function getReminderSeverityFromTitle(title: string): 'critical' | 'high' | 'medium' {
  const normalized = title.toLowerCase();
  if (normalized.includes('urgent')) return 'critical';
  if (normalized.includes('important')) return 'high';
  return 'medium';
}

function getTrendHeightClass(pct: number): string {
  if (pct >= 95) return 'h-16';
  if (pct >= 80) return 'h-14';
  if (pct >= 65) return 'h-12';
  if (pct >= 50) return 'h-10';
  if (pct >= 35) return 'h-8';
  if (pct >= 20) return 'h-6';
  return 'h-4';
}

const ApplicationTracker: React.FC<ApplicationTrackerProps> = ({
  applications,
  onUpdateApplicationStatus,
  onToggleChecklistItem,
  onRemoveApplication,
  onUpdateApplicationNotes,
  onImportApplications,
  onCreateReminder,
  reminders,
  onUpdateReminder,
  onCancelReminder,
}) => {
  const { bursaries } = useBursaries();
  const bursaryNameById = useMemo(
    () => new Map(bursaries.map((item) => [item.id, item.name])),
    [bursaries]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Application['status']>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('deadline-asc');
  const [page, setPage] = useState(1);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<Application['status']>('draft');
  const [bulkChecklistKey, setBulkChecklistKey] = useState<'idCopy' | 'transcript' | 'motivationLetter' | 'references'>('idCopy');
  const [customReminderDate, setCustomReminderDate] = useState<Record<string, string>>({});
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [pendingDeleteUntil, setPendingDeleteUntil] = useState<number | null>(null);
  const [presetName, setPresetName] = useState('');
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>(() => {
    try {
      const raw = localStorage.getItem(FILTER_PRESETS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FilterPreset[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [reminderDraftDueDate, setReminderDraftDueDate] = useState<Record<string, string>>({});
  const [automationMode, setAutomationMode] = useState<AutomationMode>(() => {
    try {
      const raw = localStorage.getItem(AUTOMATION_MODE_STORAGE_KEY);
      return raw === 'manual' ? 'manual' : 'assisted';
    } catch {
      return 'assisted';
    }
  });
  const [focusedApplicationId, setFocusedApplicationId] = useState<string | null>(null);
  const [trendSnapshots, setTrendSnapshots] = useState<TrackerTrendSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem(TRACKER_TRENDS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as TrackerTrendSnapshot[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [automationAuditEntries, setAutomationAuditEntries] = useState<AutomationAuditEntry[]>(() => {
    try {
      const raw = localStorage.getItem(AUTOMATION_AUDIT_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as AutomationAuditEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditTimeWindow, setAuditTimeWindow] = useState<AuditTimeWindow>('30d');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [queuedReminderIds, setQueuedReminderIds] = useState<string[]>([]);
  const [dailyTaskFilter, setDailyTaskFilter] = useState<'all' | 'pending' | 'done' | 'skipped'>('all');
  const [archivePage, setArchivePage] = useState(1);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');
  const [archiveSourceDateFilter, setArchiveSourceDateFilter] = useState('');
  const [archiveSortBy, setArchiveSortBy] = useState<ArchiveSortOption>('dismissed-desc');
  const [archiveAnalyticsWindow, setArchiveAnalyticsWindow] = useState<ArchiveAnalyticsWindow>('7d');
  const [selectedArchiveEntryIds, setSelectedArchiveEntryIds] = useState<string[]>([]);
  const [goalHistory, setGoalHistory] = useState<DailyGoalRecord[]>(() => {
    try {
      const raw = localStorage.getItem(GOAL_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as DailyGoalRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [dailyTaskQueueByDate, setDailyTaskQueueByDate] = useState<Record<string, DailyTaskQueueItem[]>>(() => {
    try {
      const raw = localStorage.getItem(DAILY_TASK_QUEUE_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, DailyTaskQueueItem[]>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [dismissedBacklogArchive, setDismissedBacklogArchive] = useState<DismissedBacklogArchiveEntry[]>(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_BACKLOG_ARCHIVE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as DismissedBacklogArchiveEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const historyInputRef = useRef<HTMLInputElement | null>(null);
  const pendingDeleteTimerRef = useRef<number | null>(null);
  const applicationCardRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    localStorage.setItem(FILTER_PRESETS_STORAGE_KEY, JSON.stringify(filterPresets));
  }, [filterPresets]);

  useEffect(() => {
    localStorage.setItem(TRACKER_TRENDS_STORAGE_KEY, JSON.stringify(trendSnapshots));
  }, [trendSnapshots]);

  useEffect(() => {
    localStorage.setItem(AUTOMATION_MODE_STORAGE_KEY, automationMode);
  }, [automationMode]);

  useEffect(() => {
    localStorage.setItem(AUTOMATION_AUDIT_STORAGE_KEY, JSON.stringify(automationAuditEntries));
  }, [automationAuditEntries]);

  useEffect(() => {
    localStorage.setItem(GOAL_HISTORY_STORAGE_KEY, JSON.stringify(goalHistory));
  }, [goalHistory]);

  useEffect(() => {
    localStorage.setItem(DAILY_TASK_QUEUE_STORAGE_KEY, JSON.stringify(dailyTaskQueueByDate));
  }, [dailyTaskQueueByDate]);

  useEffect(() => {
    localStorage.setItem(DISMISSED_BACKLOG_ARCHIVE_STORAGE_KEY, JSON.stringify(dismissedBacklogArchive));
  }, [dismissedBacklogArchive]);

  useEffect(() => {
    const available = new Set(dismissedBacklogArchive.map((item) => item.id));
    setSelectedArchiveEntryIds((prev) => prev.filter((id) => available.has(id)));
  }, [dismissedBacklogArchive]);

  useEffect(() => {
    setArchivePage(1);
  }, [dismissedBacklogArchive.length]);

  useEffect(() => {
    setArchivePage(1);
  }, [archiveSearchQuery, archiveSourceDateFilter, archiveSortBy]);

  useEffect(() => {
    return () => {
      if (pendingDeleteTimerRef.current !== null) {
        window.clearTimeout(pendingDeleteTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, deadlineFilter, sortBy]);

  useEffect(() => {
    const syncDrafts: Record<string, string> = {};
    for (const app of applications) {
      syncDrafts[app.id] = app.notes || '';
    }
    setNoteDrafts(syncDrafts);
  }, [applications]);

  useEffect(() => {
    const pendingSaves: number[] = [];

    for (const app of applications) {
      const draft = noteDrafts[app.id];
      const source = app.notes || '';

      if (draft === undefined || draft === source) {
        continue;
      }

      const timer = window.setTimeout(async () => {
        setSavingNotes((prev) => ({ ...prev, [app.id]: true }));
        try {
          const normalized = draft.trim();
          await onUpdateApplicationNotes(app.id, normalized.length > 0 ? normalized : undefined);
        } finally {
          setSavingNotes((prev) => ({ ...prev, [app.id]: false }));
        }
      }, 700);

      pendingSaves.push(timer);
    }

    return () => pendingSaves.forEach((timer) => window.clearTimeout(timer));
  }, [applications, noteDrafts, onUpdateApplicationNotes]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const reminder of reminders) {
      if (reminder.type !== 'deadline-reminder' || reminder.channel !== 'in-app') continue;
      if (!reminder.dueDate) continue;
      next[reminder.id] = reminder.dueDate;
    }
    setReminderDraftDueDate(next);
  }, [reminders]);

  const pendingDeleteSet = useMemo(() => new Set(pendingDeleteIds), [pendingDeleteIds]);
  const effectiveApplications = useMemo(
    () => applications.filter((item) => !pendingDeleteSet.has(item.id)),
    [applications, pendingDeleteSet]
  );
  const applicationById = useMemo(
    () => new Map(applications.map((item) => [item.id, item])),
    [applications]
  );

  const getChecklistProgress = (application: Application) => {
    const values = [
      !!application.checklist?.idCopy,
      !!application.checklist?.transcript,
      !!application.checklist?.motivationLetter,
      !!application.checklist?.references,
    ];
    const completed = values.filter(Boolean).length;
    return {
      completed,
      total: values.length,
      pct: Math.round((completed / values.length) * 100),
    };
  };

  const getDeadlineMeta = (deadlineDate?: string) => {
    if (!deadlineDate) {
      return { rank: 999999, label: 'No deadline', tone: 'bg-gray-100 text-gray-700', isOverdue: false };
    }

    const now = new Date();
    const deadline = new Date(deadlineDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / msPerDay);

    if (daysLeft < 0) {
      return { rank: -1, label: `${Math.abs(daysLeft)}d overdue`, tone: 'bg-red-100 text-red-700', isOverdue: true };
    }
    if (daysLeft === 0) {
      return { rank: 0, label: 'Due today', tone: 'bg-amber-100 text-amber-800', isOverdue: false };
    }
    if (daysLeft <= 7) {
      return { rank: daysLeft, label: `${daysLeft}d left`, tone: 'bg-orange-100 text-orange-700', isOverdue: false };
    }
    return { rank: daysLeft, label: `${daysLeft}d left`, tone: 'bg-green-100 text-green-700', isOverdue: false };
  };

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matchesDeadline = (item: Application) => {
      if (deadlineFilter === 'all') return true;
      if (deadlineFilter === 'none') return !item.deadlineDate;
      if (!item.deadlineDate) return false;

      const now = Date.now();
      const deadline = new Date(item.deadlineDate).getTime();
      const msPerDay = 24 * 60 * 60 * 1000;
      const diffDays = Math.ceil((deadline - now) / msPerDay);

      if (deadlineFilter === 'overdue') return diffDays < 0;
      if (deadlineFilter === 'today') return diffDays === 0;
      if (deadlineFilter === '7d') return diffDays >= 0 && diffDays <= 7;
      if (deadlineFilter === '30d') return diffDays >= 0 && diffDays <= 30;
      return true;
    };

    const sorted = effectiveApplications
      .filter((item) => {
        const bursaryName = (bursaryNameById.get(item.bursaryId) || item.bursaryId).toLowerCase();
        const matchesQuery =
          query === '' ||
          bursaryName.includes(query) ||
          item.bursaryId.toLowerCase().includes(query) ||
          (item.notes || '').toLowerCase().includes(query);
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        return matchesQuery && matchesStatus && matchesDeadline(item);
      })
      .sort((a, b) => {
        if (sortBy === 'name') {
          const nameA = bursaryNameById.get(a.bursaryId) || a.bursaryId;
          const nameB = bursaryNameById.get(b.bursaryId) || b.bursaryId;
          return nameA.localeCompare(nameB);
        }

        if (sortBy === 'status') {
          return a.status.localeCompare(b.status);
        }

        if (sortBy === 'updated-asc') {
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        }

        if (sortBy === 'updated-desc') {
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }

        const aDeadline = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDeadline = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;

        if (sortBy === 'deadline-desc') {
          return bDeadline - aDeadline;
        }
        return aDeadline - bDeadline;
      });

    return sorted;
  }, [bursaryNameById, deadlineFilter, effectiveApplications, searchQuery, sortBy, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visibleItems = filtered.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    const allowed = new Set(filtered.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => allowed.has(id)));
  }, [filtered]);

  const exportCsv = () => {
    const headers = [
      'applicationId',
      'bursaryId',
      'bursaryName',
      'status',
      'deadlineDate',
      'checklistCompleted',
      'checklistTotal',
      'notes',
      'updatedAt',
    ];

    const rows = filtered.map((item) => {
      const progress = getChecklistProgress(item);
      const bursaryName = bursaryNameById.get(item.bursaryId) || item.bursaryId;
      return [
        item.id,
        item.bursaryId,
        bursaryName,
        item.status,
        item.deadlineDate || '',
        String(progress.completed),
        String(progress.total),
        (item.notes || '').replace(/\r?\n/g, ' '),
        item.updatedAt,
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eduhub-applications-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    cells.push(current.trim());
    return cells;
  };

  const parseCsvRows = (csvText: string) => {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return [] as Partial<Application>[];
    }

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const headerIndex = (name: string) => headers.indexOf(name.toLowerCase());

    const getByHeader = (cells: string[], name: string) => {
      const idx = headerIndex(name);
      return idx >= 0 ? cells[idx] : '';
    };

    const statusValues: Application['status'][] = ['draft', 'submitted', 'under-review', 'successful', 'unsuccessful'];
    const nameToId = new Map<string, string>();
    bursaries.forEach((b) => nameToId.set(b.name.toLowerCase(), b.id));

    const rows: Partial<Application>[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cells = parseCsvLine(lines[i]);
      const rawBursaryId = getByHeader(cells, 'bursaryId');
      const rawBursaryName = getByHeader(cells, 'bursaryName');
      const resolvedBursaryId =
        rawBursaryId || (rawBursaryName ? nameToId.get(rawBursaryName.toLowerCase()) || '' : '');
      if (!resolvedBursaryId) continue;

      const rawStatus = getByHeader(cells, 'status') as Application['status'];
      const status = statusValues.includes(rawStatus) ? rawStatus : 'draft';

      rows.push({
        id: getByHeader(cells, 'applicationId') || undefined,
        bursaryId: resolvedBursaryId,
        status,
        deadlineDate: getByHeader(cells, 'deadlineDate') || undefined,
        notes: getByHeader(cells, 'notes') || undefined,
      });
    }

    return rows;
  };

  const handleCsvImport = async (file?: File) => {
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const rows = parseCsvRows(content);
      if (rows.length === 0) {
        toast({ title: 'No valid rows found', description: 'CSV must include at least bursaryId or bursaryName.' });
        return;
      }

      const created = await onImportApplications(rows);
      toast({
        title: 'Import complete',
        description: `${created} application${created !== 1 ? 's' : ''} imported from CSV.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'CSV import failed',
        description: 'Please check the file format and try again.',
        variant: 'destructive',
      });
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const setSelectionToVisible = () => {
    setSelectedIds(visibleItems.map((item) => item.id));
  };

  const setSelectionToFiltered = () => {
    setSelectedIds(filtered.map((item) => item.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const finalizePendingDeletion = async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      await Promise.all(ids.map((id) => onRemoveApplication(id)));
      toast({
        title: 'Applications deleted',
        description: `${ids.length} application${ids.length !== 1 ? 's were' : ' was'} removed.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Delete failed',
        description: 'Some selected applications could not be removed.',
        variant: 'destructive',
      });
    } finally {
      setPendingDeleteIds((prev) => (prev.join('|') === ids.join('|') ? [] : prev));
      setPendingDeleteUntil(null);
      pendingDeleteTimerRef.current = null;
    }
  };

  const undoPendingDeletion = () => {
    if (pendingDeleteTimerRef.current !== null) {
      window.clearTimeout(pendingDeleteTimerRef.current);
      pendingDeleteTimerRef.current = null;
    }
    setPendingDeleteIds([]);
    setPendingDeleteUntil(null);
    toast({ title: 'Delete undone', description: 'Selected applications were restored.' });
  };

  const applyBulkStatus = async () => {
    if (selectedIds.length === 0) return;
    await Promise.all(selectedIds.map((id) => onUpdateApplicationStatus(id, bulkStatus)));
    toast({ title: 'Bulk status updated', description: `${selectedIds.length} item(s) updated to ${bulkStatus}.` });
  };

  const applyBulkChecklistToggle = async () => {
    if (selectedIds.length === 0) return;
    await Promise.all(selectedIds.map((id) => onToggleChecklistItem(id, bulkChecklistKey)));
    toast({ title: 'Bulk checklist updated', description: `${selectedIds.length} item(s) toggled.` });
  };

  const removeSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Queue ${selectedIds.length} selected applications for removal? You can undo for a few seconds.`)) {
      return;
    }

    const ids = [...selectedIds];
    setPendingDeleteIds(ids);
    setPendingDeleteUntil(Date.now() + SOFT_DELETE_WINDOW_MS);
    clearSelection();

    if (pendingDeleteTimerRef.current !== null) {
      window.clearTimeout(pendingDeleteTimerRef.current);
    }

    pendingDeleteTimerRef.current = window.setTimeout(() => {
      void finalizePendingDeletion(ids);
    }, SOFT_DELETE_WINDOW_MS);

    toast({
      title: 'Delete scheduled',
      description: `${ids.length} application${ids.length !== 1 ? 's' : ''} will be removed in a few seconds unless undone.`,
    });
  };

  const saveCurrentPreset = () => {
    const name = presetName.trim();
    if (!name) {
      toast({ title: 'Preset name required', description: 'Enter a name before saving.', variant: 'destructive' });
      return;
    }

    const preset: FilterPreset = {
      id: `${Date.now()}`,
      name,
      searchQuery,
      statusFilter,
      deadlineFilter,
      sortBy,
    };

    setFilterPresets((prev) => [preset, ...prev].slice(0, 10));
    setPresetName('');
    toast({ title: 'Preset saved', description: `Saved "${name}".` });
  };

  const applyPreset = (presetId: string) => {
    const target = filterPresets.find((item) => item.id === presetId);
    if (!target) return;

    setSearchQuery(target.searchQuery);
    setStatusFilter(target.statusFilter);
    setDeadlineFilter(target.deadlineFilter);
    setSortBy(target.sortBy);
    toast({ title: 'Preset applied', description: `Applied "${target.name}".` });
  };

  const removePreset = (presetId: string) => {
    setFilterPresets((prev) => prev.filter((item) => item.id !== presetId));
  };

  const createReminder = async (application: Application, daysFromNow: number) => {
    const dueDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await onCreateReminder({
      applicationId: application.id,
      dueDate,
      title: 'Application reminder',
      message: `Reminder set for ${bursaryNameById.get(application.bursaryId) || application.bursaryId}.`,
    });

    toast({ title: 'Reminder created', description: `A reminder has been scheduled for ${dueDate}.` });
  };

  const createCustomReminder = async (application: Application) => {
    const dueDate = customReminderDate[application.id];
    if (!dueDate) {
      toast({ title: 'Select a date first', description: 'Choose a reminder date before creating it.', variant: 'destructive' });
      return;
    }

    await onCreateReminder({
      applicationId: application.id,
      dueDate,
      title: 'Application reminder',
      message: `Custom reminder set for ${bursaryNameById.get(application.bursaryId) || application.bursaryId}.`,
    });

    toast({ title: 'Custom reminder created', description: `Reminder scheduled for ${dueDate}.` });
  };

  const reminderCenterItems = useMemo(() => {
    return reminders
      .filter((item) => item.channel === 'in-app' && item.type === 'deadline-reminder')
      .sort((a, b) => {
        const aMs = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bMs = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aMs - bMs;
      })
      .slice(0, 12);
  }, [reminders]);

  const activeApplications = useMemo(
    () => effectiveApplications.filter((item) => item.status !== 'successful' && item.status !== 'unsuccessful'),
    [effectiveApplications]
  );

  const dueIn7DaysCount = useMemo(() => {
    const now = Date.now();
    const end = now + 7 * 24 * 60 * 60 * 1000;
    return activeApplications.filter((item) => {
      if (!item.deadlineDate) return false;
      const due = new Date(item.deadlineDate).getTime();
      return due >= now && due <= end;
    }).length;
  }, [activeApplications]);

  const overdueCount = useMemo(
    () =>
      effectiveApplications.filter((item) => {
        if (!item.deadlineDate) return false;
        if (item.status === 'successful' || item.status === 'unsuccessful') return false;
        return new Date(item.deadlineDate).getTime() < Date.now();
      }).length,
    [effectiveApplications]
  );

  const averageChecklistPct = useMemo(() => {
    if (activeApplications.length === 0) return 0;
    const total = activeApplications.reduce((sum, item) => sum + getChecklistProgress(item).pct, 0);
    return Math.round(total / activeApplications.length);
  }, [activeApplications]);

  const dueNext14DaysCount = useMemo(() => {
    const now = Date.now();
    const end = now + 14 * 24 * 60 * 60 * 1000;
    return activeApplications.filter((item) => {
      if (!item.deadlineDate) return false;
      const due = new Date(item.deadlineDate).getTime();
      return due >= now && due <= end;
    }).length;
  }, [activeApplications]);

  const reminderAppIdSet = useMemo(() => {
    return new Set(
      reminders
        .filter((item) => item.channel === 'in-app' && item.type === 'deadline-reminder' && !!item.entityId)
        .map((item) => item.entityId as string)
    );
  }, [reminders]);

  const queuedReminderSet = useMemo(() => new Set(queuedReminderIds), [queuedReminderIds]);

  const weeklyReminderCandidates = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return activeApplications
      .filter((application) => {
        if (!application.deadlineDate) return false;
        if (reminderAppIdSet.has(application.id) || queuedReminderSet.has(application.id)) return false;
        const daysLeft = Math.ceil((new Date(application.deadlineDate).getTime() - now) / dayMs);
        return daysLeft >= 0 && daysLeft <= 7;
      })
      .sort((a, b) => {
        const aDue = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      });
  }, [activeApplications, queuedReminderSet, reminderAppIdSet]);

  const recommendedDailyTaskLoad = useMemo(() => {
    if (activeApplications.length === 0) return 0;
    const weighted = dueNext14DaysCount + overdueCount * 2;
    return Math.max(1, Math.ceil(weighted / 7));
  }, [activeApplications.length, dueNext14DaysCount, overdueCount]);

  const executionPressureLabel = useMemo(() => {
    if (overdueCount > 0 || dueNext14DaysCount >= 6) return 'High pressure';
    if (dueNext14DaysCount >= 3) return 'Moderate pressure';
    return 'Low pressure';
  }, [dueNext14DaysCount, overdueCount]);

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayGoalRecord = useMemo(
    () => goalHistory.find((item) => item.date === todayDate),
    [goalHistory, todayDate]
  );

  const weeklyGoalCompletionCount = useMemo(() => {
    const dateToRecord = new Map(goalHistory.map((item) => [item.date, item]));
    let completed = 0;

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const record = dateToRecord.get(day);
      if (record && record.completed >= record.target) {
        completed += 1;
      }
    }

    return completed;
  }, [goalHistory]);

  const dailyGoalStreak = useMemo(() => {
    const dateToRecord = new Map(goalHistory.map((item) => [item.date, item]));
    let streak = 0;

    for (let i = 0; i < 30; i += 1) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const record = dateToRecord.get(day);
      if (!record || record.completed < record.target) {
        break;
      }
      streak += 1;
    }

    return streak;
  }, [goalHistory]);

  const trailing14GoalRate = useMemo(() => {
    const dateToRecord = new Map(goalHistory.map((item) => [item.date, item]));
    let completedDays = 0;
    let trackedDays = 0;

    for (let i = 0; i < 14; i += 1) {
      const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const record = dateToRecord.get(day);
      if (!record) continue;
      trackedDays += 1;
      if (record.completed >= record.target) {
        completedDays += 1;
      }
    }

    if (trackedDays === 0) return 0.5;
    return completedDays / trackedDays;
  }, [goalHistory]);

  const adaptiveDailyTaskTarget = useMemo(() => {
    if (recommendedDailyTaskLoad === 0) return 0;
    if (trailing14GoalRate >= 0.8) return recommendedDailyTaskLoad + 1;
    if (trailing14GoalRate < 0.4) return Math.max(1, recommendedDailyTaskLoad - 1);
    return recommendedDailyTaskLoad;
  }, [recommendedDailyTaskLoad, trailing14GoalRate]);

  const previousDate = useMemo(
    () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    []
  );

  const carryOverTasks = useMemo(() => {
    const previous = dailyTaskQueueByDate[previousDate] || [];
    return previous
      .filter((item) => item.status === 'skipped')
      .map((item) => ({
        ...item,
        id: `${item.id}:carry:${todayDate}`,
        label: `Carry-over: ${item.label}`,
        status: 'pending' as const,
        carryOver: true,
        priorityScore: 100,
      }));
  }, [dailyTaskQueueByDate, previousDate, todayDate]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const snapshot: TrackerTrendSnapshot = {
      date: today,
      activeCount: activeApplications.length,
      overdueCount,
      dueIn7DaysCount,
      averageChecklistPct,
    };

    setTrendSnapshots((prev) => {
      if (prev.length > 0 && prev[0].date === today) {
        const next = [...prev];
        next[0] = snapshot;
        return next;
      }
      return [snapshot, ...prev].slice(0, 30);
    });
  }, [activeApplications.length, averageChecklistPct, dueIn7DaysCount, overdueCount]);

  const highRiskApplications = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const scored = activeApplications.map((item) => {
      const progress = getChecklistProgress(item);
      const deadlineMs = item.deadlineDate ? new Date(item.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
      const daysLeft = deadlineMs === Number.MAX_SAFE_INTEGER ? 999 : Math.ceil((deadlineMs - now) / dayMs);

      let risk = 0;
      if (daysLeft < 0) risk += 100;
      else if (daysLeft <= 3) risk += 70;
      else if (daysLeft <= 7) risk += 40;
      else if (daysLeft <= 14) risk += 20;

      risk += Math.max(0, 100 - progress.pct) * 0.5;
      if (item.status === 'draft') risk += 10;

      return {
        item,
        daysLeft,
        progress,
        risk,
      };
    });

    return scored.sort((a, b) => b.risk - a.risk).slice(0, 3);
  }, [activeApplications]);

  const weeklyPlan = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const items: WeeklyPlanItem[] = [];

    activeApplications.forEach((application) => {
      const bursaryName = bursaryNameById.get(application.bursaryId) || application.bursaryId;
      const checklist = application.checklist || {
        idCopy: false,
        transcript: false,
        motivationLetter: false,
        references: false,
      };

      const missing = checklistItems
        .filter((item) => !checklist[item.key])
        .map((item) => item.label);

      if (missing.length === 0 && application.status !== 'draft') {
        return;
      }

      const deadlineMs = application.deadlineDate
        ? new Date(application.deadlineDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const daysLeft = deadlineMs === Number.MAX_SAFE_INTEGER ? 30 : Math.ceil((deadlineMs - now) / dayMs);

      const urgencyLabel =
        daysLeft < 0
          ? 'Overdue - act immediately'
          : daysLeft <= 2
          ? 'Today/Tomorrow'
          : daysLeft <= 7
          ? 'This week'
          : 'Upcoming';

      if (missing.length > 0) {
        items.push({
          id: `${application.id}-docs`,
          applicationId: application.id,
          bursaryName,
          actionLabel: `Prepare ${missing.slice(0, 2).join(' and ')}${missing.length > 2 ? ' +' : ''}`,
          urgencyLabel,
          sortScore: daysLeft,
        });
      }

      if (application.status === 'draft') {
        items.push({
          id: `${application.id}-submit`,
          applicationId: application.id,
          bursaryName,
          actionLabel: 'Move application from Draft to Submitted',
          urgencyLabel,
          sortScore: daysLeft - 1,
        });
      }
    });

    return items.sort((a, b) => a.sortScore - b.sortScore).slice(0, 8);
  }, [activeApplications, bursaryNameById]);

  const dailyTaskSeed = useMemo(() => {
    const merged = new Map<string, DailyTaskQueueItem>();

    carryOverTasks.forEach((item) => {
      merged.set(item.id, item);
    });

    weeklyPlan.forEach((item) => {
      const id = `${item.applicationId}:${item.id}`;
      merged.set(id, {
        id,
        applicationId: item.applicationId,
        bursaryName: item.bursaryName,
        label: item.actionLabel,
        status: 'pending',
        carryOver: false,
        priorityScore: 60,
      });
    });

    highRiskApplications.forEach((entry) => {
      const appId = entry.item.id;
      const id = `${appId}:risk`;
      if (merged.has(id)) return;
      merged.set(id, {
        id,
        applicationId: appId,
        bursaryName: bursaryNameById.get(entry.item.bursaryId) || entry.item.bursaryId,
        label: 'Resolve high-risk blockers and finalize next action',
        status: 'pending',
        carryOver: false,
        priorityScore: 80,
      });
    });

    return [...merged.values()]
      .sort((a, b) => b.priorityScore - a.priorityScore || a.bursaryName.localeCompare(b.bursaryName))
      .slice(0, Math.max(1, adaptiveDailyTaskTarget));
  }, [adaptiveDailyTaskTarget, bursaryNameById, carryOverTasks, highRiskApplications, weeklyPlan]);

  useEffect(() => {
    setDailyTaskQueueByDate((prev) => {
      if ((prev[todayDate] || []).length > 0) {
        return prev;
      }
      if (dailyTaskSeed.length === 0) {
        return prev;
      }

      const next = {
        ...prev,
        [todayDate]: dailyTaskSeed,
      };

      const orderedDates = Object.keys(next).sort((a, b) => b.localeCompare(a));
      const trimmed: Record<string, DailyTaskQueueItem[]> = {};
      orderedDates.slice(0, 21).forEach((date) => {
        trimmed[date] = next[date];
      });
      return trimmed;
    });
  }, [dailyTaskSeed, todayDate]);

  const todayTaskQueue = useMemo(() => dailyTaskQueueByDate[todayDate] || [], [dailyTaskQueueByDate, todayDate]);
  const visibleTodayTaskQueue = useMemo(() => {
    if (dailyTaskFilter === 'all') return todayTaskQueue;
    return todayTaskQueue.filter((item) => item.status === dailyTaskFilter);
  }, [dailyTaskFilter, todayTaskQueue]);
  const todayTaskDoneCount = useMemo(
    () => todayTaskQueue.filter((item) => item.status === 'done').length,
    [todayTaskQueue]
  );
  const todayTaskPendingCount = useMemo(
    () => todayTaskQueue.filter((item) => item.status === 'pending').length,
    [todayTaskQueue]
  );

  const goalTrend14Days = useMemo(() => {
    const dateToRecord = new Map(goalHistory.map((item) => [item.date, item]));
    const points: GoalTrendPoint[] = [];

    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const record = dateToRecord.get(date);
      const target = record?.target || adaptiveDailyTaskTarget || 1;
      const completed = record?.completed || 0;
      const pct = target > 0 ? Math.min(100, Math.round((completed / target) * 100)) : 0;
      points.push({ date, completed, target, pct });
    }

    return points;
  }, [adaptiveDailyTaskTarget, goalHistory]);

  const carryOverBacklog = useMemo(() => {
    const todayMs = new Date(todayDate).getTime();
    const buckets: BacklogBucket[] = [
      { label: '1 day old', count: 0 },
      { label: '2-3 days old', count: 0 },
      { label: '4-7 days old', count: 0 },
      { label: '8+ days old', count: 0 },
    ];

    Object.entries(dailyTaskQueueByDate).forEach(([date, items]) => {
      if (date === todayDate) return;
      const ageDays = Math.max(0, Math.floor((todayMs - new Date(date).getTime()) / (24 * 60 * 60 * 1000)));
      const skippedCount = items.filter((item) => item.status === 'skipped').length;
      if (skippedCount === 0) return;

      if (ageDays <= 1) buckets[0].count += skippedCount;
      else if (ageDays <= 3) buckets[1].count += skippedCount;
      else if (ageDays <= 7) buckets[2].count += skippedCount;
      else buckets[3].count += skippedCount;
    });

    return buckets.filter((item) => item.count > 0);
  }, [dailyTaskQueueByDate, todayDate]);

  const oldSkippedBacklogCount = useMemo(() => {
    const todayMs = new Date(todayDate).getTime();
    let count = 0;

    Object.entries(dailyTaskQueueByDate).forEach(([date, items]) => {
      if (date === todayDate) return;
      const ageDays = Math.max(0, Math.floor((todayMs - new Date(date).getTime()) / (24 * 60 * 60 * 1000)));
      if (ageDays <= 7) return;
      count += items.filter((item) => item.status === 'skipped').length;
    });

    return count;
  }, [dailyTaskQueueByDate, todayDate]);

  const focusApplication = (applicationId: string) => {
    const target = applicationById.get(applicationId);
    if (!target) return;

    const bursaryName = bursaryNameById.get(target.bursaryId) || target.bursaryId;
    setSearchQuery(bursaryName);
    setStatusFilter('all');
    setDeadlineFilter('all');
    setSortBy('deadline-asc');
    setPage(1);
    setFocusedApplicationId(applicationId);
  };

  useEffect(() => {
    if (!focusedApplicationId) return;
    const visible = visibleItems.some((item) => item.id === focusedApplicationId);
    if (!visible) return;

    const card = applicationCardRefs.current[focusedApplicationId];
    if (!card) return;

    if (typeof card.scrollIntoView === 'function') {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    card.focus();
    setFocusedApplicationId(null);
  }, [focusedApplicationId, visibleItems]);

  const saveReminderEdit = async (reminder: NotificationRecord) => {
    const dueDate = reminderDraftDueDate[reminder.id];
    if (!dueDate) {
      toast({ title: 'Date required', description: 'Pick a due date before saving.', variant: 'destructive' });
      return;
    }

    await onUpdateReminder(reminder.id, { dueDate });
    toast({ title: 'Reminder updated', description: `Reminder moved to ${dueDate}.` });
  };

  const cancelReminder = async (reminder: NotificationRecord) => {
    if (!window.confirm('Cancel this reminder?')) {
      return;
    }
    await onCancelReminder(reminder.id);
    toast({ title: 'Reminder canceled', description: 'The reminder has been removed.' });
  };

  const appendAutomationAudit = useCallback((entry: Omit<AutomationAuditEntry, 'id' | 'timestamp'>) => {
    const next: AutomationAuditEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };

    setAutomationAuditEntries((prev) => [next, ...prev].slice(0, 50));
  }, []);

  const auditActionOptions = useMemo(() => {
    return ['all', ...new Set(automationAuditEntries.map((item) => item.action))];
  }, [automationAuditEntries]);

  const filteredAuditEntries = useMemo(() => {
    const now = Date.now();
    const query = auditSearchQuery.trim().toLowerCase();

    return automationAuditEntries.filter((entry) => {
      const matchesAction = auditActionFilter === 'all' || entry.action === auditActionFilter;
      if (!matchesAction) return false;

      const matchesQuery =
        query === '' ||
        entry.action.toLowerCase().includes(query) ||
        entry.targetLabel.toLowerCase().includes(query) ||
        entry.reason.toLowerCase().includes(query);
      if (!matchesQuery) return false;

      if (auditTimeWindow === 'all') return true;

      const limitDays = auditTimeWindow === '7d' ? 7 : 30;
      const ageMs = now - new Date(entry.timestamp).getTime();
      return ageMs <= limitDays * 24 * 60 * 60 * 1000;
    });
  }, [auditActionFilter, auditSearchQuery, auditTimeWindow, automationAuditEntries]);

  useEffect(() => {
    setAuditPage(1);
  }, [auditActionFilter, auditSearchQuery, auditTimeWindow]);

  const auditActionSummary = useMemo(() => {
    const counts = new Map<string, number>();
    filteredAuditEntries.forEach((entry) => {
      counts.set(entry.action, (counts.get(entry.action) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [filteredAuditEntries]);

  const totalAuditPages = Math.max(1, Math.ceil(filteredAuditEntries.length / AUDIT_PAGE_SIZE));
  const safeAuditPage = Math.min(auditPage, totalAuditPages);
  const auditStart = (safeAuditPage - 1) * AUDIT_PAGE_SIZE;
  const visibleAuditEntries = filteredAuditEntries.slice(auditStart, auditStart + AUDIT_PAGE_SIZE);

  const downloadAuditCsv = (entries: AutomationAuditEntry[], filenamePrefix: string) => {
    if (entries.length === 0) return;

    const headers = ['timestamp', 'action', 'target', 'reason'];
    const rows = entries.map((entry) => [
      entry.timestamp,
      entry.action,
      entry.targetLabel,
      entry.reason,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportAuditCsv = () => {
    if (filteredAuditEntries.length === 0) {
      toast({ title: 'No audit entries', description: 'There are no audit entries to export for this filter.' });
      return;
    }

    downloadAuditCsv(filteredAuditEntries, 'eduhub-automation-audit');
  };

  const clearAuditLog = () => {
    if (automationAuditEntries.length === 0) {
      toast({ title: 'Audit log already empty', description: 'There are no entries to clear.' });
      return;
    }

    if (!window.confirm('Clear the automation audit log? A backup CSV will be downloaded first.')) {
      return;
    }

    downloadAuditCsv(automationAuditEntries, 'eduhub-automation-audit-backup');
    setAutomationAuditEntries([]);
    setAuditPage(1);
    toast({ title: 'Audit log cleared', description: 'Backup exported and entries removed.' });
  };

  const completeMissingDocs = async (application: Application) => {
    const missingKeys = checklistItems
      .filter((item) => !application.checklist?.[item.key])
      .map((item) => item.key);

    if (missingKeys.length === 0) {
      toast({ title: 'No missing docs', description: 'All checklist documents are already marked complete.' });
      return;
    }

    await Promise.all(missingKeys.map((key) => onToggleChecklistItem(application.id, key)));
    const bursaryName = bursaryNameById.get(application.bursaryId) || application.bursaryId;
    toast({
      title: 'Checklist completed',
      description: `${missingKeys.length} checklist item${missingKeys.length !== 1 ? 's were' : ' was'} marked complete.`,
    });
    appendAutomationAudit({
      action: 'Completed missing checklist documents',
      targetLabel: bursaryName,
      reason: `Filled ${missingKeys.length} missing checklist items`,
    });
  };

  const getLatestReminderAgeDays = (applicationId: string) => {
    const appReminders = reminders
      .filter(
        (item) =>
          item.channel === 'in-app' &&
          item.type === 'deadline-reminder' &&
          item.entityId === applicationId
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (appReminders.length === 0) return null;
    const latest = appReminders[0];
    const ageMs = Date.now() - new Date(latest.createdAt).getTime();
    return Math.floor(ageMs / (24 * 60 * 60 * 1000));
  };

  const transitionToUnderReview = async (application: Application) => {
    const bursaryName = bursaryNameById.get(application.bursaryId) || application.bursaryId;
    await onUpdateApplicationStatus(application.id, 'under-review');
    toast({ title: 'Status automated', description: 'Application moved to Under Review.' });
    appendAutomationAudit({
      action: 'Moved status to under-review',
      targetLabel: bursaryName,
      reason: 'Submitted application had aging reminders and complete checklist',
    });
  };

  const getAutomationSuggestion = (application: Application): AutomationSuggestion | null => {
    const progress = getChecklistProgress(application);
    const hasDeadline = !!application.deadlineDate;
    const daysLeft = hasDeadline
      ? Math.ceil((new Date(application.deadlineDate as string).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : 999;
    const reminderAgeDays = getLatestReminderAgeDays(application.id);
    const bursaryName = bursaryNameById.get(application.bursaryId) || application.bursaryId;

    if (progress.pct === 100 && application.status === 'draft') {
      return {
        label: 'All required documents are complete. Ready to submit.',
        buttonText: 'Mark as submitted',
        run: async (item) => {
          await onUpdateApplicationStatus(item.id, 'submitted');
          toast({ title: 'Status automated', description: 'Application moved to Submitted.' });
          appendAutomationAudit({
            action: 'Moved status to submitted',
            targetLabel: bursaryName,
            reason: 'Checklist reached 100% in Draft status',
          });
        },
      };
    }

    if (
      application.status === 'submitted' &&
      progress.pct === 100 &&
      reminderAgeDays !== null &&
      reminderAgeDays >= 5
    ) {
      return {
        label: 'Submitted application has aging reminders and can move to review stage.',
        buttonText: 'Mark as under review',
        run: transitionToUnderReview,
      };
    }

    if (progress.pct < 100 && daysLeft <= 3 && daysLeft >= 0) {
      return {
        label: 'Deadline is near and checklist is incomplete.',
        buttonText: 'Complete missing docs',
        run: completeMissingDocs,
      };
    }

    return null;
  };

  const snoozeReminder = async (reminder: NotificationRecord, days: number) => {
    const base = reminder.dueDate ? new Date(reminder.dueDate) : new Date();
    const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await onUpdateReminder(reminder.id, { dueDate: next });
    toast({ title: 'Reminder snoozed', description: `Reminder moved by ${days} day${days !== 1 ? 's' : ''}.` });
    appendAutomationAudit({
      action: 'Snoozed reminder',
      targetLabel: reminder.title,
      reason: `Shifted due date by ${days} days`,
    });
  };

  const queueWeeklyReminders = async () => {
    const candidates = weeklyReminderCandidates.slice(0, 5);
    if (candidates.length === 0) {
      toast({
        title: 'No reminders needed',
        description: 'All applications due in the next 7 days already have reminders.',
      });
      return;
    }

    await Promise.all(
      candidates.map((application) =>
        onCreateReminder({
          applicationId: application.id,
          dueDate: application.deadlineDate as string,
          title: 'Important: deadline this week',
          message: `Deadline is approaching for ${bursaryNameById.get(application.bursaryId) || application.bursaryId}.`,
        })
      )
    );

    setQueuedReminderIds((prev) => [...new Set([...prev, ...candidates.map((item) => item.id)])]);

    appendAutomationAudit({
      action: 'Queued weekly deadline reminders',
      targetLabel: `${candidates.length} application${candidates.length !== 1 ? 's' : ''}`,
      reason: 'Applications due in the next 7 days had no active reminders',
    });

    toast({
      title: 'Weekly reminders queued',
      description: `${candidates.length} deadline reminder${candidates.length !== 1 ? 's were' : ' was'} created.`,
    });
  };

  const logTodayGoalComplete = useCallback(() => {
    if (todayGoalRecord && todayGoalRecord.completed >= todayGoalRecord.target) {
      toast({ title: 'Already completed', description: 'Today is already marked as complete.' });
      return;
    }

    setGoalHistory((prev) => {
      const withoutToday = prev.filter((item) => item.date !== todayDate);
      const next: DailyGoalRecord = {
        date: todayDate,
        completed: adaptiveDailyTaskTarget,
        target: adaptiveDailyTaskTarget,
      };
      return [next, ...withoutToday].slice(0, 60);
    });

    appendAutomationAudit({
      action: 'Logged daily execution goal',
      targetLabel: todayDate,
      reason: `Completed ${adaptiveDailyTaskTarget}/${adaptiveDailyTaskTarget} recommended tasks`,
    });

    toast({
      title: 'Goal marked complete',
      description: `Daily target of ${adaptiveDailyTaskTarget} task${adaptiveDailyTaskTarget !== 1 ? 's' : ''} recorded.`,
    });
  }, [adaptiveDailyTaskTarget, appendAutomationAudit, todayDate, todayGoalRecord]);

  const updateTodayTaskStatus = (taskId: string, status: 'pending' | 'done' | 'skipped') => {
    const targetTask = todayTaskQueue.find((item) => item.id === taskId);
    if (!targetTask) return;

    setDailyTaskQueueByDate((prev) => {
      const current = prev[todayDate] || [];
      return {
        ...prev,
        [todayDate]: current.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status,
              }
            : item
        ),
      };
    });

    if (status === 'done') {
      appendAutomationAudit({
        action: 'Completed daily queue task',
        targetLabel: targetTask.bursaryName,
        reason: targetTask.label,
      });
      return;
    }

    if (status === 'skipped') {
      appendAutomationAudit({
        action: 'Skipped daily queue task',
        targetLabel: targetTask.bursaryName,
        reason: targetTask.label,
      });
      return;
    }

    appendAutomationAudit({
      action: 'Reopened daily queue task',
      targetLabel: targetTask.bursaryName,
      reason: targetTask.label,
    });
  };

  const cleanupOldSkippedBacklog = () => {
    const todayMs = new Date(todayDate).getTime();
    let removedCount = 0;
    const archivedEntries: DismissedBacklogArchiveEntry[] = [];
    const next: Record<string, DailyTaskQueueItem[]> = {};

    Object.entries(dailyTaskQueueByDate).forEach(([date, items]) => {
      if (date === todayDate) {
        next[date] = items;
        return;
      }

      const ageDays = Math.max(0, Math.floor((todayMs - new Date(date).getTime()) / (24 * 60 * 60 * 1000)));
      if (ageDays <= 7) {
        next[date] = items;
        return;
      }

      const removedItems = items.filter((item) => item.status === 'skipped');
      const remaining = items.filter((item) => item.status !== 'skipped');
      removedCount += removedItems.length;
      if (removedItems.length > 0) {
        archivedEntries.push({
          id: `${date}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          dismissedAt: new Date().toISOString(),
          sourceDate: date,
          items: removedItems,
        });
      }
      if (remaining.length > 0) {
        next[date] = remaining;
      }
    });

    setDailyTaskQueueByDate(next);

    if (archivedEntries.length > 0) {
      setDismissedBacklogArchive((prev) => [...archivedEntries, ...prev].slice(0, 20));
    }

    if (removedCount === 0) {
      toast({ title: 'No old backlog to dismiss', description: 'There were no skipped items older than 7 days.' });
      return;
    }

    appendAutomationAudit({
      action: 'Dismissed old skipped backlog',
      targetLabel: `${removedCount} skipped item${removedCount !== 1 ? 's' : ''}`,
      reason: 'Removed skipped carry-over items older than 7 days',
    });

    toast({
      title: 'Backlog cleaned up',
      description: `${removedCount} skipped item${removedCount !== 1 ? 's were' : ' was'} dismissed from old queue history.`,
    });
  };

  const restoreDismissedArchiveEntry = (entryId: string) => {
    const entry = dismissedBacklogArchive.find((item) => item.id === entryId);
    if (!entry) return;

    const restoredAt = Date.now();
    const restoredItems = entry.items.map((item, index) => ({
      ...item,
      id: `${item.id}-restored-${restoredAt}-${index}`,
      status: 'pending' as const,
      carryOver: true,
    }));

    setDailyTaskQueueByDate((prev) => {
      const current = prev[todayDate] || [];
      return {
        ...prev,
        [todayDate]: [...restoredItems, ...current],
      };
    });
    setDismissedBacklogArchive((prev) => prev.filter((item) => item.id !== entryId));

    appendAutomationAudit({
      action: 'Restored dismissed backlog entry',
      targetLabel: `${restoredItems.length} task${restoredItems.length !== 1 ? 's' : ''}`,
      reason: `Restored from archive entry dated ${entry.sourceDate}`,
    });

    toast({
      title: 'Archive entry restored',
      description: `${restoredItems.length} task${restoredItems.length !== 1 ? 's were' : ' was'} restored to today's queue.`,
    });
  };

  const removeDismissedArchiveEntry = (entryId: string) => {
    const entry = dismissedBacklogArchive.find((item) => item.id === entryId);
    if (!entry) return;

    setDismissedBacklogArchive((prev) => prev.filter((item) => item.id !== entryId));

    appendAutomationAudit({
      action: 'Removed dismissed backlog archive entry',
      targetLabel: `${entry.items.length} item${entry.items.length !== 1 ? 's' : ''}`,
      reason: `Removed archive entry from ${entry.sourceDate}`,
    });

    toast({
      title: 'Archive entry removed',
      description: `Removed ${entry.items.length} archived item${entry.items.length !== 1 ? 's' : ''}.`,
    });
  };

  const clearDismissedBacklogArchive = () => {
    if (dismissedBacklogArchive.length === 0) {
      toast({ title: 'Archive already empty', description: 'There are no dismissed entries to clear.' });
      return;
    }

    if (!window.confirm('Clear the dismissed backlog archive?')) {
      return;
    }

    const clearedCount = dismissedBacklogArchive.length;
    setDismissedBacklogArchive([]);

    appendAutomationAudit({
      action: 'Cleared dismissed backlog archive',
      targetLabel: `${clearedCount} entr${clearedCount === 1 ? 'y' : 'ies'}`,
      reason: 'Manual archive clear from queue controls',
    });

    toast({
      title: 'Archive cleared',
      description: `${clearedCount} archive entr${clearedCount === 1 ? 'y was' : 'ies were'} removed.`,
    });
  };

  const toggleArchiveEntrySelection = (entryId: string) => {
    setSelectedArchiveEntryIds((prev) =>
      prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]
    );
  };

  const toggleSelectVisibleArchiveEntries = (visibleEntryIds: string[]) => {
    if (visibleEntryIds.length === 0) return;
    const visibleSet = new Set(visibleEntryIds);
    const allSelected = visibleEntryIds.every((id) => selectedArchiveEntryIds.includes(id));

    if (allSelected) {
      setSelectedArchiveEntryIds((prev) => prev.filter((id) => !visibleSet.has(id)));
      return;
    }

    setSelectedArchiveEntryIds((prev) => [...new Set([...prev, ...visibleEntryIds])]);
  };

  const restoreSelectedArchiveEntries = () => {
    if (selectedArchiveEntryIds.length === 0) {
      toast({ title: 'No entries selected', description: 'Select archive entries to restore first.' });
      return;
    }

    const selectedSet = new Set(selectedArchiveEntryIds);
    const selectedEntries = dismissedBacklogArchive.filter((entry) => selectedSet.has(entry.id));
    if (selectedEntries.length === 0) {
      toast({ title: 'No entries selected', description: 'Select archive entries to restore first.' });
      return;
    }

    const restoredAt = Date.now();
    const restoredItems = selectedEntries.flatMap((entry, entryIndex) =>
      entry.items.map((item, itemIndex) => ({
        ...item,
        id: `${item.id}-restored-${restoredAt}-${entryIndex}-${itemIndex}`,
        status: 'pending' as const,
        carryOver: true,
      }))
    );

    setDailyTaskQueueByDate((prev) => {
      const current = prev[todayDate] || [];
      return {
        ...prev,
        [todayDate]: [...restoredItems, ...current],
      };
    });
    setDismissedBacklogArchive((prev) => prev.filter((entry) => !selectedSet.has(entry.id)));
    setSelectedArchiveEntryIds([]);

    appendAutomationAudit({
      action: 'Restored dismissed backlog entries',
      targetLabel: `${selectedEntries.length} entr${selectedEntries.length === 1 ? 'y' : 'ies'}`,
      reason: `Restored ${restoredItems.length} tasks into today's queue`,
    });

    toast({
      title: 'Archive entries restored',
      description: `${restoredItems.length} task${restoredItems.length !== 1 ? 's were' : ' was'} restored to today's queue.`,
    });
  };

  const removeSelectedArchiveEntries = () => {
    if (selectedArchiveEntryIds.length === 0) {
      toast({ title: 'No entries selected', description: 'Select archive entries to remove first.' });
      return;
    }

    const selectedSet = new Set(selectedArchiveEntryIds);
    const selectedEntries = dismissedBacklogArchive.filter((entry) => selectedSet.has(entry.id));
    if (selectedEntries.length === 0) {
      toast({ title: 'No entries selected', description: 'Select archive entries to remove first.' });
      return;
    }

    const removedItemsCount = selectedEntries.reduce((total, entry) => total + entry.items.length, 0);
    setDismissedBacklogArchive((prev) => prev.filter((entry) => !selectedSet.has(entry.id)));
    setSelectedArchiveEntryIds([]);

    appendAutomationAudit({
      action: 'Removed dismissed backlog archive entries',
      targetLabel: `${selectedEntries.length} entr${selectedEntries.length === 1 ? 'y' : 'ies'}`,
      reason: `Removed ${removedItemsCount} archived items`,
    });

    toast({
      title: 'Archive entries removed',
      description: `${selectedEntries.length} archive entr${selectedEntries.length === 1 ? 'y was' : 'ies were'} removed.`,
    });
  };

  const moveTodayTask = (taskId: string, direction: 'up' | 'down') => {
    setDailyTaskQueueByDate((prev) => {
      const current = prev[todayDate] || [];
      const index = current.findIndex((item) => item.id === taskId);
      if (index === -1) return prev;

      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= current.length) return prev;

      const next = [...current];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return {
        ...prev,
        [todayDate]: next,
      };
    });

    const targetTask = todayTaskQueue.find((item) => item.id === taskId);
    if (!targetTask) return;

    appendAutomationAudit({
      action: direction === 'up' ? 'Moved daily task up' : 'Moved daily task down',
      targetLabel: targetTask.bursaryName,
      reason: targetTask.label,
    });
  };

  const exportExecutionHistory = () => {
    const payload: DailyHistoryExport = {
      goalHistory,
      dailyTaskQueueByDate,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: HISTORY_EXPORT_MIME });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eduhub-execution-history-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importExecutionHistory = async (file?: File) => {
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const parsed = JSON.parse(content) as Partial<DailyHistoryExport>;
      const nextGoalHistory = Array.isArray(parsed.goalHistory) ? parsed.goalHistory : [];
      const nextQueueByDate = parsed.dailyTaskQueueByDate && typeof parsed.dailyTaskQueueByDate === 'object'
        ? (parsed.dailyTaskQueueByDate as Record<string, DailyTaskQueueItem[]>)
        : {};

      setGoalHistory(nextGoalHistory);
      setDailyTaskQueueByDate(nextQueueByDate);
      toast({
        title: 'Execution history imported',
        description: `Loaded ${nextGoalHistory.length} goal record${nextGoalHistory.length !== 1 ? 's' : ''}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Import failed',
        description: 'History JSON could not be parsed.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (adaptiveDailyTaskTarget === 0 || todayTaskQueue.length === 0) return;
    if (todayTaskDoneCount < adaptiveDailyTaskTarget) return;
    if (todayGoalRecord && todayGoalRecord.completed >= todayGoalRecord.target) return;

    logTodayGoalComplete();
  }, [adaptiveDailyTaskTarget, logTodayGoalComplete, todayGoalRecord, todayTaskDoneCount, todayTaskQueue.length]);

  const filteredDismissedBacklogArchive = useMemo(() => {
    const query = archiveSearchQuery.trim().toLowerCase();

    const filtered = dismissedBacklogArchive.filter((entry) => {
      const matchesDate = !archiveSourceDateFilter || entry.sourceDate === archiveSourceDateFilter;
      if (!matchesDate) return false;

      if (!query) return true;

      const matchesEntryDate = entry.sourceDate.toLowerCase().includes(query);
      const matchesItems = entry.items.some((item) => {
        const label = item.label.toLowerCase();
        const bursaryName = item.bursaryName.toLowerCase();
        return label.includes(query) || bursaryName.includes(query);
      });

      return matchesEntryDate || matchesItems;
    });

    const sorted = [...filtered].sort((a, b) => {
      if (archiveSortBy === 'dismissed-asc') {
        return new Date(a.dismissedAt).getTime() - new Date(b.dismissedAt).getTime();
      }
      if (archiveSortBy === 'source-desc') {
        return b.sourceDate.localeCompare(a.sourceDate);
      }
      if (archiveSortBy === 'source-asc') {
        return a.sourceDate.localeCompare(b.sourceDate);
      }
      return new Date(b.dismissedAt).getTime() - new Date(a.dismissedAt).getTime();
    });

    return sorted;
  }, [archiveSearchQuery, archiveSourceDateFilter, archiveSortBy, dismissedBacklogArchive]);

  const archiveAnalytics = useMemo(() => {
    const now = Date.now();
    const daysLimit = archiveAnalyticsWindow === '7d' ? 7 : archiveAnalyticsWindow === '30d' ? 30 : null;

    const isWithinWindow = (iso: string) => {
      if (daysLimit === null) return true;
      const ageMs = now - new Date(iso).getTime();
      return ageMs <= daysLimit * 24 * 60 * 60 * 1000;
    };

    const parseCountFromTarget = (targetLabel: string) => {
      const match = targetLabel.match(/^(\d+)/);
      if (!match) return 1;
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) ? parsed : 1;
    };

    const dismissedEntriesCount = dismissedBacklogArchive.filter((entry) => isWithinWindow(entry.dismissedAt)).length;

    const restoredCount = automationAuditEntries
      .filter(
        (entry) =>
          isWithinWindow(entry.timestamp) &&
          (entry.action === 'Restored dismissed backlog entry' || entry.action === 'Restored dismissed backlog entries')
      )
      .reduce((total, entry) => total + parseCountFromTarget(entry.targetLabel), 0);

    const removedCount = automationAuditEntries
      .filter(
        (entry) =>
          isWithinWindow(entry.timestamp) &&
          (entry.action === 'Removed dismissed backlog archive entry' ||
            entry.action === 'Removed dismissed backlog archive entries' ||
            entry.action === 'Cleared dismissed backlog archive')
      )
      .reduce((total, entry) => total + parseCountFromTarget(entry.targetLabel), 0);

    return {
      dismissedEntriesCount,
      restoredCount,
      removedCount,
    };
  }, [archiveAnalyticsWindow, automationAuditEntries, dismissedBacklogArchive]);

  const totalArchivePages = Math.max(1, Math.ceil(filteredDismissedBacklogArchive.length / ARCHIVE_PAGE_SIZE));
  const safeArchivePage = Math.min(archivePage, totalArchivePages);
  const archiveStart = (safeArchivePage - 1) * ARCHIVE_PAGE_SIZE;
  const visibleArchiveEntries = filteredDismissedBacklogArchive.slice(archiveStart, archiveStart + ARCHIVE_PAGE_SIZE);
  const visibleArchiveEntryIds = visibleArchiveEntries.map((entry) => entry.id);
  const hasSelectedArchiveEntries = selectedArchiveEntryIds.length > 0;
  const allVisibleArchiveEntriesSelected =
    visibleArchiveEntryIds.length > 0 && visibleArchiveEntryIds.every((id) => selectedArchiveEntryIds.includes(id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileCheck2 className="w-7 h-7 text-blue-700" />
            Application Tracker
          </h1>
          <p className="text-gray-600 mt-1">Track progress, manage documents, and stay ahead of deadlines.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            aria-label="Import tracker CSV"
            title="Import tracker CSV"
            onChange={(event) => {
              const file = event.target.files?.[0];
              void handleCsvImport(file);
              event.currentTarget.value = '';
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800"
          >
            <Download className="w-4 h-4" />
            Export Filtered CSV
          </button>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {overdueCount} active application{overdueCount !== 1 ? 's are' : ' is'} overdue.
        </div>
      )}

      {pendingDeleteIds.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>
            {pendingDeleteIds.length} application{pendingDeleteIds.length !== 1 ? 's are' : ' is'} queued for deletion.
            {pendingDeleteUntil ? ' Undo before the timer expires.' : ''}
          </span>
          <button
            onClick={undoPendingDeletion}
            className="px-3 py-1.5 rounded border border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            Undo delete
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Active Applications</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{activeApplications.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Overdue</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{overdueCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Due In 7 Days</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{dueIn7DaysCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Avg Checklist Completion</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{averageChecklistPct}%</p>
        </div>
      </div>

      <div className="mb-6">
        <KnowledgeCards context="tracker" compact />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Automation Mode</p>
          <p className="text-xs text-gray-600 mt-1">
            Assisted mode surfaces one-click completion and status suggestions. Manual mode keeps guidance only.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
          <button
            onClick={() => setAutomationMode('assisted')}
            className={`px-3 py-1.5 text-xs ${
              automationMode === 'assisted'
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Assisted
          </button>
          <button
            onClick={() => setAutomationMode('manual')}
            className={`px-3 py-1.5 text-xs border-l border-gray-300 ${
              automationMode === 'manual'
                ? 'bg-blue-700 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Manual
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Priority Queue</h2>
        {highRiskApplications.length === 0 ? (
          <p className="text-sm text-gray-600">No active applications to prioritize right now.</p>
        ) : (
          <div className="space-y-2">
            {highRiskApplications.map((entry) => (
              <div key={entry.item.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {bursaryNameById.get(entry.item.bursaryId) || entry.item.bursaryId}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {entry.daysLeft < 0
                        ? `${Math.abs(entry.daysLeft)}d overdue`
                        : entry.daysLeft === 0
                        ? 'Due today'
                        : entry.daysLeft < 999
                        ? `${entry.daysLeft}d left`
                        : 'No deadline set'}
                      {' • '}
                      {entry.progress.completed}/{entry.progress.total} checklist items done
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                    Risk {Math.round(entry.risk)}
                  </span>
                </div>
                <button
                  onClick={() => focusApplication(entry.item.id)}
                  className="mt-2 text-xs px-2.5 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Resolve now
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Weekly Planner</h2>
        {weeklyPlan.length === 0 ? (
          <p className="text-sm text-gray-600">No immediate planning tasks. Great momentum.</p>
        ) : (
          <div className="space-y-2">
            {weeklyPlan.map((item) => (
              <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.bursaryName}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{item.actionLabel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 text-gray-700">
                      {item.urgencyLabel}
                    </span>
                    <button
                      onClick={() => focusApplication(item.applicationId)}
                      className="text-xs px-2.5 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Tracker Trends (Last 7 Snapshots)</h2>
        {trendSnapshots.length === 0 ? (
          <p className="text-sm text-gray-600">No trend snapshots yet.</p>
        ) : (
          <div className="space-y-2">
            {trendSnapshots.slice(0, 7).map((snapshot) => (
              <div key={snapshot.date} className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs border border-gray-200 rounded-lg p-2">
                <span className="font-medium text-gray-700">{snapshot.date}</span>
                <span className="text-gray-600">Active: {snapshot.activeCount}</span>
                <span className="text-red-700">Overdue: {snapshot.overdueCount}</span>
                <span className="text-amber-700">Due 7d: {snapshot.dueIn7DaysCount}</span>
                <span className="text-green-700">Checklist: {snapshot.averageChecklistPct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Execution Forecast</h2>
            <p className="text-xs text-gray-600 mt-1">Turn upcoming deadline load into a concrete weekly execution pace.</p>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
              executionPressureLabel === 'High pressure'
                ? 'bg-red-50 text-red-700 border-red-200'
                : executionPressureLabel === 'Moderate pressure'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}
          >
            {executionPressureLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Due Next 14 Days</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{dueNext14DaysCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Need Reminder (7d)</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{weeklyReminderCandidates.length}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Recommended Daily Tasks</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{recommendedDailyTaskLoad}</p>
          </div>
        </div>

        <p className="text-xs text-gray-600">
          Keep momentum by completing at least {adaptiveDailyTaskTarget} high-value tracker task{adaptiveDailyTaskTarget !== 1 ? 's' : ''} per day this week.
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Adaptive target: {adaptiveDailyTaskTarget} task{adaptiveDailyTaskTarget !== 1 ? 's' : ''} (base {recommendedDailyTaskLoad}).
        </p>

        {automationMode === 'assisted' ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => void queueWeeklyReminders()}
              className="text-xs px-3 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              Queue weekly reminders
            </button>
            <span className="text-xs text-gray-500">Creates up to 5 reminders for nearest upcoming deadlines.</span>
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">Switch to Assisted mode to queue reminders automatically.</p>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Daily Goal Tracker</h3>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-md border border-gray-200 p-2.5">
              <p className="text-gray-500">Today</p>
              <p className="text-gray-900 font-medium mt-0.5">
                {todayGoalRecord && todayGoalRecord.completed >= todayGoalRecord.target
                  ? 'Completed today'
                  : `${adaptiveDailyTaskTarget} tasks target`}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 p-2.5">
              <p className="text-gray-500">7-day completion</p>
              <p className="text-gray-900 font-medium mt-0.5">{weeklyGoalCompletionCount}/7 days</p>
            </div>
            <div className="rounded-md border border-gray-200 p-2.5">
              <p className="text-gray-500">Current streak</p>
              <p className="text-gray-900 font-medium mt-0.5">{dailyGoalStreak} day{dailyGoalStreak !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={logTodayGoalComplete}
            disabled={!!todayGoalRecord && todayGoalRecord.completed >= todayGoalRecord.target}
            className="mt-3 text-xs px-3 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          >
            Log today as complete
          </button>

          <div className="mt-3">
            <p className="text-[11px] text-gray-500 mb-1">14-day completion trend</p>
            <div className="flex items-end gap-1 h-16" aria-label="Goal trend chart">
              {goalTrend14Days.map((point) => (
                <div
                  key={point.date}
                  title={`${point.date}: ${point.completed}/${point.target}`}
                  className={`w-2 rounded-sm ${getTrendHeightClass(point.pct)} ${
                    point.pct >= 100 ? 'bg-emerald-500' : point.pct >= 50 ? 'bg-amber-400' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Daily Task Queue</h3>
            <p className="text-xs text-gray-500">
              {todayTaskDoneCount} done • {todayTaskPendingCount} pending
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={historyInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Import execution history"
              title="Import execution history"
              onChange={(event) => {
                const file = event.target.files?.[0];
                void importExecutionHistory(file);
                event.currentTarget.value = '';
              }}
            />
            <button
              onClick={exportExecutionHistory}
              className="text-[11px] px-2.5 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Export history
            </button>
            <button
              onClick={() => historyInputRef.current?.click()}
              className="text-[11px] px-2.5 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Import history
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'done', 'skipped'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDailyTaskFilter(filter)}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${
                  dailyTaskFilter === filter
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          {carryOverBacklog.length > 0 ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs font-medium text-amber-800">Carry-over backlog</p>
                <button
                  onClick={cleanupOldSkippedBacklog}
                  disabled={oldSkippedBacklogCount === 0}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-amber-300 bg-white text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                >
                  Dismiss old skipped
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {carryOverBacklog.map((bucket) => (
                  <span key={bucket.label} className="text-[11px] px-2 py-1 rounded-full border border-amber-200 bg-white text-amber-800">
                    {bucket.label}: {bucket.count}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-amber-800">
                Old skipped items older than 7 days: {oldSkippedBacklogCount}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-500">No skipped carry-over backlog to review.</p>
          )}
          {dismissedBacklogArchive.length > 0 ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-xs font-medium text-slate-800">Dismissed backlog archive</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-700">
                    Page {safeArchivePage} of {totalArchivePages}
                  </span>
                  <button
                    onClick={() => setArchivePage((prev) => Math.max(1, prev - 1))}
                    aria-label="Previous archive page"
                    disabled={safeArchivePage === 1}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setArchivePage((prev) => Math.min(totalArchivePages, prev + 1))}
                    aria-label="Next archive page"
                    disabled={safeArchivePage === totalArchivePages}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => toggleSelectVisibleArchiveEntries(visibleArchiveEntryIds)}
                    aria-label="Toggle visible archive selection"
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    {allVisibleArchiveEntriesSelected ? 'Deselect visible' : 'Select visible'}
                  </button>
                  <button
                    onClick={restoreSelectedArchiveEntries}
                    aria-label="Restore selected archive entries"
                    disabled={!hasSelectedArchiveEntries}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-blue-300 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    Restore selected
                  </button>
                  <button
                    onClick={removeSelectedArchiveEntries}
                    aria-label="Remove selected archive entries"
                    disabled={!hasSelectedArchiveEntries}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Remove selected
                  </button>
                  <span className="text-[11px] px-2 py-1 rounded-full border border-slate-200 bg-white text-slate-700">
                    {filteredDismissedBacklogArchive.length}/{dismissedBacklogArchive.length} entr
                    {dismissedBacklogArchive.length === 1 ? 'y' : 'ies'}
                  </span>
                  <button
                    onClick={clearDismissedBacklogArchive}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  >
                    Clear archive
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-3 flex flex-wrap items-center gap-2">
                  {(['7d', '30d', 'all'] as const).map((windowOption) => (
                    <button
                      key={windowOption}
                      onClick={() => setArchiveAnalyticsWindow(windowOption)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border ${
                        archiveAnalyticsWindow === windowOption
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {windowOption === 'all' ? 'All time' : `Last ${windowOption}`}
                    </button>
                  ))}
                </div>
                <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Dismissed entries</p>
                    <p data-testid="archive-analytics-dismissed" className="text-sm font-semibold text-slate-900">
                      {archiveAnalytics.dismissedEntriesCount}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Restored</p>
                    <p data-testid="archive-analytics-restored" className="text-sm font-semibold text-slate-900">
                      {archiveAnalytics.restoredCount}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Removed</p>
                    <p data-testid="archive-analytics-removed" className="text-sm font-semibold text-slate-900">
                      {archiveAnalytics.removedCount}
                    </p>
                  </div>
                </div>
                <input
                  value={archiveSearchQuery}
                  onChange={(event) => setArchiveSearchQuery(event.target.value)}
                  aria-label="Archive search"
                  placeholder="Search archived task or bursary"
                  className="text-[11px] px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700"
                />
                <input
                  type="date"
                  value={archiveSourceDateFilter}
                  onChange={(event) => setArchiveSourceDateFilter(event.target.value)}
                  aria-label="Archive source date"
                  className="text-[11px] px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700"
                />
                <select
                  value={archiveSortBy}
                  onChange={(event) => setArchiveSortBy(event.target.value as ArchiveSortOption)}
                  aria-label="Archive sort"
                  className="text-[11px] px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700"
                >
                  <option value="dismissed-desc">Newest dismissed</option>
                  <option value="dismissed-asc">Oldest dismissed</option>
                  <option value="source-desc">Source date (newest)</option>
                  <option value="source-asc">Source date (oldest)</option>
                </select>
              </div>
              <div className="mt-2 space-y-2">
                {visibleArchiveEntries.map((entry) => (
                  <div key={entry.id} data-testid="archive-entry" className="rounded-md border border-slate-200 bg-white p-2.5 text-[11px] text-slate-700">
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 mb-1.5">
                      <input
                        type="checkbox"
                        aria-label={`Select archive entry ${entry.sourceDate}`}
                        checked={selectedArchiveEntryIds.includes(entry.id)}
                        onChange={() => toggleArchiveEntrySelection(entry.id)}
                      />
                      Select entry
                    </label>
                    <p className="font-medium text-slate-900">
                      {entry.sourceDate} • {entry.items.length} skipped item{entry.items.length !== 1 ? 's' : ''}
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      Dismissed {new Date(entry.dismissedAt).toLocaleDateString()} at{' '}
                      {new Date(entry.dismissedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {entry.items.slice(0, 3).map((item) => (
                        <li key={item.id}>• {item.bursaryName}: {item.label}</li>
                      ))}
                      {entry.items.length > 3 ? <li>• +{entry.items.length - 3} more</li> : null}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => restoreDismissedArchiveEntry(entry.id)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
                      >
                        Restore to queue
                      </button>
                      <button
                        onClick={() => removeDismissedArchiveEntry(entry.id)}
                        className="text-[11px] px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                      >
                        Remove entry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {filteredDismissedBacklogArchive.length === 0 ? (
                <p className="mt-2 text-[11px] text-slate-600">No archived entries match the current filters.</p>
              ) : null}
            </div>
          ) : null}
          {visibleTodayTaskQueue.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">No queue items yet. Planner tasks will appear here automatically.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {visibleTodayTaskQueue.map((task) => (
                <div key={task.id} data-testid="daily-task-queue-item" className="rounded-md border border-gray-200 p-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="font-medium text-gray-900">{task.bursaryName}</p>
                      <p className="text-gray-600 mt-0.5">{task.label}</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] ${
                        task.status === 'done'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : task.status === 'skipped'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-gray-200 bg-gray-50 text-gray-700'
                      }`}
                    >
                      {task.status === 'done' ? 'Done' : task.status === 'skipped' ? 'Skipped' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => focusApplication(task.applicationId)}
                      className="text-xs px-2.5 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      Open
                    </button>
                    {task.status !== 'done' ? (
                      <button
                        onClick={() => updateTodayTaskStatus(task.id, 'done')}
                        className="text-xs px-2.5 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        Complete task
                      </button>
                    ) : null}
                    {task.status !== 'skipped' ? (
                      <button
                        onClick={() => updateTodayTaskStatus(task.id, 'skipped')}
                        className="text-xs px-2.5 py-1 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                      >
                        Skip task
                      </button>
                    ) : null}
                    {task.status !== 'pending' ? (
                      <button
                        onClick={() => updateTodayTaskStatus(task.id, 'pending')}
                        className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Reopen
                      </button>
                    ) : null}
                    <button
                      onClick={() => moveTodayTask(task.id, 'up')}
                      disabled={todayTaskQueue.findIndex((item) => item.id === task.id) === 0}
                      className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Move up
                    </button>
                    <button
                      onClick={() => moveTodayTask(task.id, 'down')}
                      disabled={todayTaskQueue.findIndex((item) => item.id === task.id) === todayTaskQueue.length - 1}
                      className="text-xs px-2.5 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Move down
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Search by bursary or notes"
              aria-label="Search tracked applications"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | Application['status'])}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under-review">Under Review</option>
            <option value="successful">Successful</option>
            <option value="unsuccessful">Unsuccessful</option>
          </select>

          <select
            value={deadlineFilter}
            onChange={(event) => setDeadlineFilter(event.target.value as DeadlineFilter)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Filter by deadline"
          >
            <option value="all">All deadlines</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="7d">Due in 7 days</option>
            <option value="30d">Due in 30 days</option>
            <option value="none">No deadline set</option>
          </select>

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            aria-label="Sort applications"
          >
            <option value="deadline-asc">Deadline (nearest first)</option>
            <option value="deadline-desc">Deadline (latest first)</option>
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Least recently updated</option>
            <option value="status">Status</option>
            <option value="name">Bursary name</option>
          </select>
        </div>

        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5" />
          Showing {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>

        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-xs font-medium text-gray-700 mb-2">Saved Filter Presets</p>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded"
              placeholder="Preset name"
              aria-label="Filter preset name"
            />
            <button
              onClick={saveCurrentPreset}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Save className="w-3.5 h-3.5" />
              Save current
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filterPresets.length === 0 ? (
              <span className="text-xs text-gray-500">No presets yet.</span>
            ) : (
              filterPresets.map((preset) => (
                <div key={preset.id} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                  <button
                    onClick={() => applyPreset(preset.id)}
                    className="text-xs text-gray-700 hover:text-blue-700"
                  >
                    {preset.name}
                  </button>
                  <button
                    onClick={() => removePreset(preset.id)}
                    className="text-xs text-gray-400 hover:text-red-600"
                    title="Delete preset"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <BellRing className="w-4 h-4 text-indigo-700" />
          Reminder Center
        </h2>
        {reminderCenterItems.length === 0 ? (
          <p className="text-sm text-gray-600">No reminders scheduled yet.</p>
        ) : (
          <div className="space-y-2">
            {reminderCenterItems.map((reminder) => (
              <div key={reminder.id} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900">{reminder.title}</p>
                <span
                  className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[11px] border ${
                    getReminderSeverityFromTitle(reminder.title) === 'critical'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : getReminderSeverityFromTitle(reminder.title) === 'high'
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-blue-50 border-blue-200 text-blue-700'
                  }`}
                >
                  {getReminderSeverityFromTitle(reminder.title) === 'critical'
                    ? 'Critical'
                    : getReminderSeverityFromTitle(reminder.title) === 'high'
                    ? 'High'
                    : 'Medium'}
                </span>
                <p className="text-xs text-gray-600 mt-1">{reminder.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Application: {(() => {
                    if (!reminder.entityId) return 'Unknown';
                    const application = applicationById.get(reminder.entityId);
                    if (!application) return reminder.entityId;
                    return bursaryNameById.get(application.bursaryId) || application.bursaryId;
                  })()}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={reminderDraftDueDate[reminder.id] || reminder.dueDate || ''}
                    onChange={(event) =>
                      setReminderDraftDueDate((prev) => ({
                        ...prev,
                        [reminder.id]: event.target.value,
                      }))
                    }
                    className="text-xs px-2 py-1.5 border border-gray-300 rounded"
                    aria-label="Reminder due date"
                  />
                  <button
                    onClick={() => void saveReminderEdit(reminder)}
                    className="text-xs px-2.5 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  >
                    Save date
                  </button>
                  <button
                    onClick={() => void snoozeReminder(reminder, 1)}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Snooze 1d
                  </button>
                  <button
                    onClick={() => void snoozeReminder(reminder, 3)}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Snooze 3d
                  </button>
                  <button
                    onClick={() => void snoozeReminder(reminder, 7)}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                  >
                    Snooze 7d
                  </button>
                  <button
                    onClick={() => void cancelReminder(reminder)}
                    className="text-xs px-2.5 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
                  >
                    Cancel reminder
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Automation Audit Log</h2>
            <p className="text-xs text-gray-600 mt-1">Filter recent automation actions and export them.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportAuditCsv}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export audit CSV
            </button>
            <button
              onClick={clearAuditLog}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
            >
              Clear audit log
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-2">
          <input
            value={auditSearchQuery}
            onChange={(event) => setAuditSearchQuery(event.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-300 rounded"
            placeholder="Search action/target/reason"
            aria-label="Audit search"
          />
          <select
            value={auditActionFilter}
            onChange={(event) => setAuditActionFilter(event.target.value)}
            className="text-xs px-2 py-1.5 border border-gray-300 rounded"
            aria-label="Audit action filter"
          >
            {auditActionOptions.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All actions' : option}
              </option>
            ))}
          </select>
          <select
            value={auditTimeWindow}
            onChange={(event) => setAuditTimeWindow(event.target.value as AuditTimeWindow)}
            className="text-xs px-2 py-1.5 border border-gray-300 rounded"
            aria-label="Audit time window"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <span className="text-xs text-gray-500">{filteredAuditEntries.length} result(s)</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {auditActionSummary.length === 0 ? (
            <span className="text-xs text-gray-500">No grouped actions for current filters.</span>
          ) : (
            auditActionSummary.map((item) => (
              <span key={item.action} className="text-[11px] px-2 py-1 rounded-full border border-gray-300 text-gray-700 bg-gray-50">
                {item.action}: {item.count}
              </span>
            ))
          )}
        </div>

        {filteredAuditEntries.length === 0 ? (
          <p className="text-sm text-gray-600">No automation actions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {visibleAuditEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-gray-200 p-3 text-xs">
                <p className="font-medium text-gray-900">{entry.action}</p>
                <p className="text-gray-700 mt-0.5">Target: {entry.targetLabel}</p>
                <p className="text-gray-600 mt-0.5">Reason: {entry.reason}</p>
                <p className="text-gray-500 mt-1">{new Date(entry.timestamp).toLocaleString('en-ZA')}</p>
              </div>
            ))}

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">Page {safeAuditPage} of {totalAuditPages}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage((prev) => Math.max(1, prev - 1))}
                  disabled={safeAuditPage === 1}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setAuditPage((prev) => Math.min(totalAuditPages, prev + 1))}
                  disabled={safeAuditPage === totalAuditPages}
                  className="text-xs px-2.5 py-1 rounded border border-gray-300 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={setSelectionToVisible}
              className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Select visible
            </button>
            <button
              onClick={setSelectionToFiltered}
              className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              Select all filtered
            </button>
            <button
              onClick={clearSelection}
              className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              Clear selection
            </button>
            <span className="text-xs text-blue-800 font-medium">{selectedIds.length} selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value as Application['status'])}
              className="text-xs px-2 py-1.5 border border-blue-300 rounded"
              aria-label="Bulk status"
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under-review">Under Review</option>
              <option value="successful">Successful</option>
              <option value="unsuccessful">Unsuccessful</option>
            </select>
            <button
              onClick={() => void applyBulkStatus()}
              disabled={selectedIds.length === 0}
              className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Apply status
            </button>

            <select
              value={bulkChecklistKey}
              onChange={(event) => setBulkChecklistKey(event.target.value as 'idCopy' | 'transcript' | 'motivationLetter' | 'references')}
              className="text-xs px-2 py-1.5 border border-blue-300 rounded"
              aria-label="Bulk checklist item"
            >
              <option value="idCopy">ID Copy</option>
              <option value="transcript">Transcript</option>
              <option value="motivationLetter">Motivation</option>
              <option value="references">References</option>
            </select>
            <button
              onClick={() => void applyBulkChecklistToggle()}
              disabled={selectedIds.length === 0}
              className="text-xs px-3 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Toggle checklist
            </button>

            <button
              onClick={() => void removeSelected()}
              disabled={selectedIds.length === 0}
              className="text-xs px-3 py-1.5 rounded border border-red-300 text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Remove selected
            </button>
          </div>
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-600">
          No applications match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleItems.map((application) => {
            const progress = getChecklistProgress(application);
            const deadlineMeta = getDeadlineMeta(application.deadlineDate);
            const automationSuggestion = getAutomationSuggestion(application);
            return (
              <article
                key={application.id}
                ref={(element) => {
                  applicationCardRefs.current[application.id] = element;
                }}
                tabIndex={-1}
                className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <button
                      onClick={() => toggleSelection(application.id)}
                      className={`mb-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                        selectedSet.has(application.id)
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-gray-50 border-gray-300 text-gray-700'
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      {selectedSet.has(application.id) ? 'Selected' : 'Select'}
                    </button>
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                      {bursaryNameById.get(application.bursaryId) || application.bursaryId}
                    </h2>
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {application.deadlineDate
                          ? `Deadline: ${new Date(application.deadlineDate).toLocaleDateString('en-ZA')}`
                          : 'No deadline recorded'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${deadlineMeta.tone}`}>
                        {deadlineMeta.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={application.status}
                      onChange={(event) => onUpdateApplicationStatus(application.id, event.target.value as Application['status'])}
                      className="text-xs border border-gray-300 rounded-md px-2 py-1"
                      aria-label="Update application status"
                    >
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="under-review">Under Review</option>
                      <option value="successful">Successful</option>
                      <option value="unsuccessful">Unsuccessful</option>
                    </select>
                    <button
                      onClick={() => onRemoveApplication(application.id)}
                      className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[12px] text-gray-600">
                    <span>Checklist Progress</span>
                    <span className="font-medium">{progress.completed}/{progress.total}</span>
                  </div>
                  <progress
                    max={100}
                    value={progress.pct}
                    className="mt-1 w-full h-2 [&::-webkit-progress-bar]:bg-gray-200 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:bg-green-500 [&::-webkit-progress-value]:rounded-full"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    {checklistItems.map((item) => {
                      const completed = !!application.checklist?.[item.key];
                      return (
                        <button
                          key={item.key}
                          onClick={() => onToggleChecklistItem(application.id, item.key)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            completed
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {completed ? <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" /> : null}
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {automationMode === 'assisted' ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void completeMissingDocs(application)}
                        className="text-xs px-2.5 py-1.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      >
                        Complete missing docs
                      </button>
                    </div>
                  ) : null}

                  {automationMode === 'assisted' && automationSuggestion ? (
                    <div className="mt-3 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2">
                      <p className="text-xs text-indigo-800">{automationSuggestion.label}</p>
                      <button
                        onClick={() => void automationSuggestion.run(application)}
                        className="mt-2 text-xs px-2.5 py-1.5 rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                      >
                        {automationSuggestion.buttonText}
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4">
                  <label htmlFor={`notes-${application.id}`} className="block text-xs font-medium text-gray-700 mb-1">
                    Notes (auto-saves)
                  </label>
                  <textarea
                    id={`notes-${application.id}`}
                    value={noteDrafts[application.id] ?? ''}
                    onChange={(event) =>
                      setNoteDrafts((prev) => ({
                        ...prev,
                        [application.id]: event.target.value,
                      }))
                    }
                    rows={3}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Track what is missing, follow-ups, and reminders..."
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    {savingNotes[application.id] ? 'Saving...' : `Last updated: ${new Date(application.updatedAt).toLocaleString('en-ZA')}`}
                  </p>
                </div>

                <div className="mt-4 border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-700 mb-2 flex items-center gap-1">
                    <BellPlus className="w-3.5 h-3.5" />
                    Reminder Presets
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void createReminder(application, 3)}
                      className="text-xs px-2.5 py-1.5 rounded border border-amber-300 text-amber-700 hover:bg-amber-50"
                    >
                      Remind in 3 days
                    </button>
                    <button
                      onClick={() => void createReminder(application, 7)}
                      className="text-xs px-2.5 py-1.5 rounded border border-orange-300 text-orange-700 hover:bg-orange-50"
                    >
                      Remind in 7 days
                    </button>
                    <input
                      type="date"
                      value={customReminderDate[application.id] || ''}
                      onChange={(event) =>
                        setCustomReminderDate((prev) => ({
                          ...prev,
                          [application.id]: event.target.value,
                        }))
                      }
                      className="text-xs px-2 py-1.5 border border-gray-300 rounded"
                      aria-label="Custom reminder date"
                    />
                    <button
                      onClick={() => void createCustomReminder(application)}
                      className="text-xs px-2.5 py-1.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                    >
                      Set custom reminder
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Page {safePage} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={safePage === 1}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={safePage === totalPages}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationTracker;
