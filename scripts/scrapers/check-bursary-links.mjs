import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_SEED_PATH = ['src', 'data', 'seed', 'bursaries.json'];
const DEFAULT_REPORT_PATH = ['data', 'seed', 'bursaries.link-health-report.json'];
const DEFAULT_PRIORITY_REPORT_PATH = ['data', 'seed', 'bursaries.broken-priority-report.json'];
const DEFAULT_QUARANTINE_FRESHNESS_THRESHOLD = 65;
const DEFAULT_QUARANTINE_FAILURE_STREAK = 2;
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_PRIORITY_LIMIT = 15;

function parseArgs() {
  const args = process.argv.slice(2);
  const seedIndex = args.indexOf('--seed');
  const reportIndex = args.indexOf('--report');
  const priorityReportIndex = args.indexOf('--priority-report');
  const priorityLimitIndex = args.indexOf('--priority-limit');
  const quarantineThresholdIndex = args.indexOf('--quarantine-freshness-threshold');
  const quarantineFailureStreakIndex = args.indexOf('--quarantine-failure-streak');
  const retryAttemptsIndex = args.indexOf('--retry-attempts');
  const noApply = args.includes('--no-apply');

  const quarantineFreshnessThreshold =
    quarantineThresholdIndex >= 0 && args[quarantineThresholdIndex + 1]
      ? Number(args[quarantineThresholdIndex + 1])
      : DEFAULT_QUARANTINE_FRESHNESS_THRESHOLD;

  const quarantineFailureStreak =
    quarantineFailureStreakIndex >= 0 && args[quarantineFailureStreakIndex + 1]
      ? Number(args[quarantineFailureStreakIndex + 1])
      : DEFAULT_QUARANTINE_FAILURE_STREAK;

  const retryAttempts =
    retryAttemptsIndex >= 0 && args[retryAttemptsIndex + 1]
      ? Number(args[retryAttemptsIndex + 1])
      : DEFAULT_RETRY_ATTEMPTS;

  const priorityLimit =
    priorityLimitIndex >= 0 && args[priorityLimitIndex + 1]
      ? Number(args[priorityLimitIndex + 1])
      : DEFAULT_PRIORITY_LIMIT;

  return {
    seedPath: seedIndex >= 0 && args[seedIndex + 1] ? args[seedIndex + 1] : DEFAULT_SEED_PATH.join('/'),
    reportPath: reportIndex >= 0 && args[reportIndex + 1] ? args[reportIndex + 1] : DEFAULT_REPORT_PATH.join('/'),
    priorityReportPath:
      priorityReportIndex >= 0 && args[priorityReportIndex + 1]
        ? args[priorityReportIndex + 1]
        : DEFAULT_PRIORITY_REPORT_PATH.join('/'),
    priorityLimit:
      Number.isFinite(priorityLimit) && priorityLimit >= 1
        ? Math.floor(priorityLimit)
        : DEFAULT_PRIORITY_LIMIT,
    quarantineFreshnessThreshold:
      Number.isFinite(quarantineFreshnessThreshold) && quarantineFreshnessThreshold >= 0
        ? quarantineFreshnessThreshold
        : DEFAULT_QUARANTINE_FRESHNESS_THRESHOLD,
    quarantineFailureStreak:
      Number.isFinite(quarantineFailureStreak) && quarantineFailureStreak >= 1
        ? Math.floor(quarantineFailureStreak)
        : DEFAULT_QUARANTINE_FAILURE_STREAK,
    retryAttempts:
      Number.isFinite(retryAttempts) && retryAttempts >= 0
        ? Math.floor(retryAttempts)
        : DEFAULT_RETRY_ATTEMPTS,
    apply: !noApply,
  };
}

async function checkUrlWithRetry(url, retryAttempts) {
  let attempts = 0;
  let lastResult = { ok: false, status: 0, reason: 'unknown-error' };

  for (let i = 0; i <= retryAttempts; i += 1) {
    attempts += 1;
    lastResult = await checkUrl(url);
    if (lastResult.ok) {
      if (i > 0) {
        return {
          ...lastResult,
          attempts,
          recoveredOnRetry: true,
        };
      }

      return {
        ...lastResult,
        attempts,
        recoveredOnRetry: false,
      };
    }
  }

  return {
    ...lastResult,
    attempts,
    recoveredOnRetry: false,
  };
}

async function checkUrl(url, timeoutMs = 12000) {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, status: 0, reason: 'invalid-url' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
    }

    const ok = response.status >= 200 && response.status < 400;
    return {
      ok,
      status: response.status,
      reason: ok ? 'ok' : `http-${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      reason: error instanceof Error ? error.name : 'network-error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs();
  const root = resolve(process.cwd());
  const seedPath = resolve(root, args.seedPath);
  const reportPath = resolve(root, args.reportPath);
  const priorityReportPath = resolve(root, args.priorityReportPath);

  const seedRaw = await readFile(seedPath, 'utf8');
  const seed = JSON.parse(seedRaw);
  if (!Array.isArray(seed)) {
    throw new Error('Seed file must contain an array of bursaries');
  }

  const checked = [];
  let healthy = 0;
  let broken = 0;
  let quarantined = 0;
  let recoveredOnRetryCount = 0;
  const brokenCandidates = [];

  for (const row of seed) {
    const result = await checkUrlWithRetry(row.link, args.retryAttempts);
    const currentFreshness = Number.isFinite(row.freshnessScore) ? row.freshnessScore : 100;
    const nextFreshness = result.ok ? Math.min(100, currentFreshness + 2) : Math.max(0, currentFreshness - 35);
    const previousBrokenChecks = Number.isFinite(row.consecutiveBrokenChecks)
      ? Number(row.consecutiveBrokenChecks)
      : 0;
    const nextBrokenChecks = result.ok ? 0 : previousBrokenChecks + 1;
    const shouldQuarantine =
      !result.ok &&
      nextFreshness <= args.quarantineFreshnessThreshold &&
      nextBrokenChecks >= args.quarantineFailureStreak;

    const nextRow = {
      ...row,
      freshnessScore: nextFreshness,
      verificationStatus: result.ok ? row.verificationStatus || 'verified' : 'unverified',
      linkHealthStatus: result.ok ? 'healthy' : 'broken',
      consecutiveBrokenChecks: nextBrokenChecks,
      needsReview: result.ok ? false : shouldQuarantine || !!row.needsReview,
      quarantineReason: shouldQuarantine ? 'broken-link-threshold' : undefined,
      lastLinkCheckAt: new Date().toISOString(),
    };

    if (result.ok) healthy += 1;
    else broken += 1;
    if (shouldQuarantine) quarantined += 1;
    if (result.recoveredOnRetry) recoveredOnRetryCount += 1;

    if (!result.ok) {
      brokenCandidates.push({
        id: row.id,
        name: row.name,
        provider: row.provider,
        link: row.link,
        reason: result.reason,
        status: result.status,
        consecutiveBrokenChecks: nextBrokenChecks,
        freshnessScore: nextFreshness,
        needsReview: shouldQuarantine || !!row.needsReview,
        quarantined: shouldQuarantine,
        priorityScore: nextBrokenChecks * 100 + (100 - nextFreshness),
      });
    }

    checked.push({
      id: row.id,
      name: row.name,
      link: row.link,
      ok: result.ok,
      status: result.status,
      reason: result.reason,
      attempts: result.attempts,
      recoveredOnRetry: result.recoveredOnRetry,
      quarantined: shouldQuarantine,
      brokenChecksBefore: previousBrokenChecks,
      brokenChecksAfter: nextBrokenChecks,
      freshnessBefore: currentFreshness,
      freshnessAfter: nextRow.freshnessScore,
    });

    Object.assign(row, nextRow);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalChecked: checked.length,
    healthy,
    broken,
    quarantined,
    recoveredOnRetry: recoveredOnRetryCount,
    quarantineFreshnessThreshold: args.quarantineFreshnessThreshold,
    quarantineFailureStreak: args.quarantineFailureStreak,
    retryAttempts: args.retryAttempts,
    apply: args.apply,
    results: checked,
  };

  const priorityRows = brokenCandidates
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      if (b.consecutiveBrokenChecks !== a.consecutiveBrokenChecks) {
        return b.consecutiveBrokenChecks - a.consecutiveBrokenChecks;
      }
      return a.freshnessScore - b.freshnessScore;
    })
    .slice(0, args.priorityLimit)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  const priorityReport = {
    generatedAt: new Date().toISOString(),
    totalBroken: broken,
    priorityLimit: args.priorityLimit,
    topBrokenLinks: priorityRows,
  };

  if (args.apply) {
    await writeFile(seedPath, JSON.stringify(seed, null, 2), 'utf8');
  }

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  await writeFile(priorityReportPath, JSON.stringify(priorityReport, null, 2), 'utf8');

  console.log(`Checked ${checked.length} links. Healthy: ${healthy}, broken: ${broken}.`);
  console.log(`Recovered on retry: ${recoveredOnRetryCount} (retry attempts: ${args.retryAttempts}).`);
  console.log(
    `Quarantined: ${quarantined} (freshness <= ${args.quarantineFreshnessThreshold}, streak >= ${args.quarantineFailureStreak}).`
  );
  console.log(`Report written to ${args.reportPath}`);
  console.log(`Priority report written to ${args.priorityReportPath}`);
  if (args.apply) {
    console.log(`Updated seed file: ${args.seedPath}`);
  }
}

main().catch((error) => {
  console.error('Link health check failed:', error);
  process.exit(1);
});
