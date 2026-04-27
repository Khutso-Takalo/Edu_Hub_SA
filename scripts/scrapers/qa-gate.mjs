import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_LINK_REPORT_PATH = ['data', 'seed', 'bursaries.link-health-report.json'];
const DEFAULT_SCRAPE_REPORT_PATH = ['data', 'seed', 'bursaries.scrape-report.json'];
const DEFAULT_MAX_BROKEN_RATE = 0.55;
const DEFAULT_MAX_FALLBACK_RATE = 0.7;
const DEFAULT_WARN_BROKEN_RATE = 0.5;
const DEFAULT_WARN_FALLBACK_RATE = 0.6;
const DEFAULT_MIN_OUTPUT_COUNT = 5;

function parseArgs() {
  const args = process.argv.slice(2);

  const linkReportIndex = args.indexOf('--link-report');
  const scrapeReportIndex = args.indexOf('--scrape-report');
  const maxBrokenRateIndex = args.indexOf('--max-broken-rate');
  const maxFallbackRateIndex = args.indexOf('--max-fallback-rate');
  const warnBrokenRateIndex = args.indexOf('--warn-broken-rate');
  const warnFallbackRateIndex = args.indexOf('--warn-fallback-rate');
  const minOutputCountIndex = args.indexOf('--min-output-count');

  const maxBrokenRateRaw =
    maxBrokenRateIndex >= 0 && args[maxBrokenRateIndex + 1]
      ? Number(args[maxBrokenRateIndex + 1])
      : DEFAULT_MAX_BROKEN_RATE;

  const maxFallbackRateRaw =
    maxFallbackRateIndex >= 0 && args[maxFallbackRateIndex + 1]
      ? Number(args[maxFallbackRateIndex + 1])
      : DEFAULT_MAX_FALLBACK_RATE;

  const warnBrokenRateRaw =
    warnBrokenRateIndex >= 0 && args[warnBrokenRateIndex + 1]
      ? Number(args[warnBrokenRateIndex + 1])
      : DEFAULT_WARN_BROKEN_RATE;

  const warnFallbackRateRaw =
    warnFallbackRateIndex >= 0 && args[warnFallbackRateIndex + 1]
      ? Number(args[warnFallbackRateIndex + 1])
      : DEFAULT_WARN_FALLBACK_RATE;

  const minOutputCountRaw =
    minOutputCountIndex >= 0 && args[minOutputCountIndex + 1]
      ? Number(args[minOutputCountIndex + 1])
      : DEFAULT_MIN_OUTPUT_COUNT;

  return {
    linkReportPath:
      linkReportIndex >= 0 && args[linkReportIndex + 1]
        ? args[linkReportIndex + 1]
        : DEFAULT_LINK_REPORT_PATH.join('/'),
    scrapeReportPath:
      scrapeReportIndex >= 0 && args[scrapeReportIndex + 1]
        ? args[scrapeReportIndex + 1]
        : DEFAULT_SCRAPE_REPORT_PATH.join('/'),
    maxBrokenRate:
      Number.isFinite(maxBrokenRateRaw) && maxBrokenRateRaw >= 0 ? maxBrokenRateRaw : DEFAULT_MAX_BROKEN_RATE,
    maxFallbackRate:
      Number.isFinite(maxFallbackRateRaw) && maxFallbackRateRaw >= 0
        ? maxFallbackRateRaw
        : DEFAULT_MAX_FALLBACK_RATE,
    warnBrokenRate:
      Number.isFinite(warnBrokenRateRaw) && warnBrokenRateRaw >= 0
        ? warnBrokenRateRaw
        : DEFAULT_WARN_BROKEN_RATE,
    warnFallbackRate:
      Number.isFinite(warnFallbackRateRaw) && warnFallbackRateRaw >= 0
        ? warnFallbackRateRaw
        : DEFAULT_WARN_FALLBACK_RATE,
    minOutputCount:
      Number.isFinite(minOutputCountRaw) && minOutputCountRaw >= 0
        ? Math.floor(minOutputCountRaw)
        : DEFAULT_MIN_OUTPUT_COUNT,
  };
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

function ratio(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

async function main() {
  const args = parseArgs();
  const root = resolve(process.cwd());
  const linkReportPath = resolve(root, args.linkReportPath);
  const scrapeReportPath = resolve(root, args.scrapeReportPath);

  const [linkReport, scrapeReport] = await Promise.all([
    readJson(linkReportPath),
    readJson(scrapeReportPath),
  ]);

  const totalChecked = Number(linkReport.totalChecked) || 0;
  const broken = Number(linkReport.broken) || 0;
  const totalOutput = Number(scrapeReport.outputCount) || 0;
  const fallbackCount = Number(scrapeReport.fallbackCount) || 0;

  const brokenRate = ratio(broken, totalChecked);
  const fallbackRate = ratio(fallbackCount, totalOutput);

  const failures = [];
  const warnings = [];

  if (totalOutput < args.minOutputCount) {
    failures.push(
      `Output count ${totalOutput} is below minimum threshold ${args.minOutputCount}.`
    );
  }

  if (brokenRate > args.maxBrokenRate) {
    failures.push(
      `Broken-link rate ${(brokenRate * 100).toFixed(1)}% exceeded threshold ${(args.maxBrokenRate * 100).toFixed(1)}%.`
    );
  } else if (brokenRate > args.warnBrokenRate) {
    warnings.push(
      `Broken-link rate ${(brokenRate * 100).toFixed(1)}% exceeded warning level ${(args.warnBrokenRate * 100).toFixed(1)}%.`
    );
  }

  if (fallbackRate > args.maxFallbackRate) {
    failures.push(
      `Fallback rate ${(fallbackRate * 100).toFixed(1)}% exceeded threshold ${(args.maxFallbackRate * 100).toFixed(1)}%.`
    );
  } else if (fallbackRate > args.warnFallbackRate) {
    warnings.push(
      `Fallback rate ${(fallbackRate * 100).toFixed(1)}% exceeded warning level ${(args.warnFallbackRate * 100).toFixed(1)}%.`
    );
  }

  console.log('QA Gate Metrics');
  console.log(`- totalChecked: ${totalChecked}`);
  console.log(`- broken: ${broken}`);
  console.log(`- brokenRate: ${(brokenRate * 100).toFixed(1)}%`);
  console.log(`- outputCount: ${totalOutput}`);
  console.log(`- fallbackCount: ${fallbackCount}`);
  console.log(`- fallbackRate: ${(fallbackRate * 100).toFixed(1)}%`);

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`QA Gate warning: ${warning}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`QA Gate failure: ${failure}`);
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('QA Gate passed with warnings.');
    return;
  }

  console.log('QA Gate passed.');
}

main().catch((error) => {
  console.error('QA gate failed to execute:', error);
  process.exit(1);
});
