import type { Bursary } from '@/data/staticData';

type BursaryRepository = {
  getAll: () => Promise<Bursary[]>;
  update: (id: string, changes: Partial<Bursary>) => Promise<number>;
};

type VerificationLogger = Pick<Console, 'info' | 'warn' | 'error' | 'debug'>;

export interface VerificationSchedulerConfig {
  intervalMinutes?: number;
  batchSize?: number;
  pauseWhenHidden?: boolean;
  onlyWhenOnline?: boolean;
}

export interface VerificationSnapshot {
  total: number;
  checkedInCycle: number;
  healthyInCycle: number;
  brokenInCycle: number;
  checkedOverall: number;
  healthyOverall: number;
  brokenOverall: number;
  isRunning: boolean;
  lastCheckAt: string | null;
  lastError: string | null;
}

const VERIFICATION_STATUS_KEY = 'eduhub:verification-status:v1';

const DEFAULT_CONFIG: Required<VerificationSchedulerConfig> = {
  intervalMinutes: 60,
  batchSize: 10,
  pauseWhenHidden: true,
  onlyWhenOnline: true,
};

function calculateFreshnessScore(lastVerified: string) {
  if (!lastVerified) return 0;

  const verifiedDate = new Date(lastVerified);
  const now = new Date();
  const daysSinceVerified = (now.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);

  const score = Math.max(0, 1 - daysSinceVerified / 60);
  return Math.round(score * 100) / 100;
}

function saveSnapshot(snapshot: VerificationSnapshot) {
  try {
    localStorage.setItem(VERIFICATION_STATUS_KEY, JSON.stringify(snapshot));
  } catch {
    // Snapshot persistence is best-effort.
  }
}

export function getVerificationSnapshot(): VerificationSnapshot | null {
  try {
    const raw = localStorage.getItem(VERIFICATION_STATUS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as VerificationSnapshot;
  } catch {
    return null;
  }
}

export class VerificationScheduler {
  private repo: BursaryRepository;
  private logger: VerificationLogger;
  private config: Required<VerificationSchedulerConfig>;
  private timer: number | null = null;
  private inProgress = false;
  private snapshot: VerificationSnapshot;

  constructor(repo: BursaryRepository, config: VerificationSchedulerConfig = {}, logger: VerificationLogger = console) {
    this.repo = repo;
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      intervalMinutes: Math.max(5, Math.floor(config.intervalMinutes ?? DEFAULT_CONFIG.intervalMinutes)),
      batchSize: Math.max(1, Math.floor(config.batchSize ?? DEFAULT_CONFIG.batchSize)),
    };
    this.logger = logger;
    this.snapshot =
      getVerificationSnapshot() || {
        total: 0,
        checkedInCycle: 0,
        healthyInCycle: 0,
        brokenInCycle: 0,
        checkedOverall: 0,
        healthyOverall: 0,
        brokenOverall: 0,
        isRunning: false,
        lastCheckAt: null,
        lastError: null,
      };

    this.handleVisibility = this.handleVisibility.bind(this);
    this.handleOnline = this.handleOnline.bind(this);
  }

  start(runImmediately = true) {
    if (this.snapshot.isRunning) {
      this.logger.warn('[VerificationScheduler] already running');
      return false;
    }

    this.snapshot.isRunning = true;
    this.snapshot.lastError = null;
    saveSnapshot(this.snapshot);

    this.timer = window.setInterval(() => {
      void this.runCycle();
    }, this.config.intervalMinutes * 60 * 1000);

    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('online', this.handleOnline);

    this.logger.info(
      `[VerificationScheduler] started (${this.config.intervalMinutes}m interval, batch ${this.config.batchSize})`
    );

    if (runImmediately) {
      void this.runCycle();
    }

    return true;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('online', this.handleOnline);

    this.snapshot.isRunning = false;
    saveSnapshot(this.snapshot);
    this.logger.info('[VerificationScheduler] stopped');
    return true;
  }

  getStatus() {
    return { ...this.snapshot };
  }

  private handleVisibility() {
    if (!this.config.pauseWhenHidden) return;
    if (document.visibilityState === 'visible') {
      void this.runCycle();
    }
  }

  private handleOnline() {
    if (this.config.onlyWhenOnline) {
      void this.runCycle();
    }
  }

  async runCycle() {
    if (!this.snapshot.isRunning || this.inProgress) {
      return;
    }

    if (this.config.onlyWhenOnline && !navigator.onLine) {
      this.logger.debug('[VerificationScheduler] skipped cycle while offline');
      return;
    }

    if (this.config.pauseWhenHidden && document.visibilityState === 'hidden') {
      this.logger.debug('[VerificationScheduler] skipped cycle while tab hidden');
      return;
    }

    this.inProgress = true;

    try {
      const all = await this.repo.getAll();
      const now = new Date().toISOString();

      const batch = [...all]
        .sort((a, b) => (a.freshnessScore || 0) - (b.freshnessScore || 0))
        .slice(0, this.config.batchSize);

      let healthy = 0;
      let broken = 0;

      for (const bursary of batch) {
        const isHealthy = await this.verifyLink(bursary.link);
        const consecutiveBroken = isHealthy ? 0 : (bursary.consecutiveBrokenChecks || 0) + 1;

        await this.repo.update(bursary.id, {
          linkHealthStatus: isHealthy ? 'healthy' : 'broken',
          consecutiveBrokenChecks: consecutiveBroken,
          lastVerified: now,
          freshnessScore: calculateFreshnessScore(now),
          quarantineReason:
            !isHealthy && consecutiveBroken >= 3
              ? `Link broken in ${consecutiveBroken} consecutive checks`
              : bursary.quarantineReason,
        });

        if (isHealthy) {
          healthy += 1;
        } else {
          broken += 1;
        }
      }

      this.snapshot = {
        ...this.snapshot,
        total: all.length,
        checkedInCycle: batch.length,
        healthyInCycle: healthy,
        brokenInCycle: broken,
        checkedOverall: this.snapshot.checkedOverall + batch.length,
        healthyOverall: this.snapshot.healthyOverall + healthy,
        brokenOverall: this.snapshot.brokenOverall + broken,
        lastCheckAt: now,
        lastError: null,
      };

      saveSnapshot(this.snapshot);
      window.dispatchEvent(new CustomEvent('eduhub:verification-updated', { detail: this.snapshot }));
      this.logger.info(
        `[VerificationScheduler] cycle complete: ${healthy} healthy / ${broken} broken (${batch.length} checked)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.snapshot = {
        ...this.snapshot,
        lastError: message,
      };
      saveSnapshot(this.snapshot);
      this.logger.error('[VerificationScheduler] cycle failed:', error);
    } finally {
      this.inProgress = false;
    }
  }

  private async verifyLink(link: string | undefined, timeoutMs = 10000) {
    if (!link || link === '#') {
      return true;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(link, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        mode: 'no-cors',
      });

      // no-cors responses are opaque with status 0. If fetch resolved, we treat the endpoint as reachable.
      return response.type === 'opaque' || (response.status >= 200 && response.status < 400);
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
