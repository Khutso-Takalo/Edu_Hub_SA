import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_SEED_PATH = ['src', 'data', 'seed', 'bursaries.json'];
const DEFAULT_REPORT_PATH = ['data', 'seed', 'bursaries.reconciliation-report.json'];

function parseArgs() {
  const args = process.argv.slice(2);
  const seedIndex = args.indexOf('--seed');
  const reportIndex = args.indexOf('--report');
  const noApply = args.includes('--no-apply');

  return {
    seedPath: seedIndex >= 0 && args[seedIndex + 1] ? args[seedIndex + 1] : DEFAULT_SEED_PATH.join('/'),
    reportPath: reportIndex >= 0 && args[reportIndex + 1] ? args[reportIndex + 1] : DEFAULT_REPORT_PATH.join('/'),
    apply: !noApply,
  };
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function groupKey(row) {
  return `${normalizeToken(row.provider)}|${normalizeToken(row.name)}`;
}

function detectConflict(rows) {
  const deadlines = new Set(rows.map((row) => normalizeToken(row.deadline)).filter(Boolean));
  const amounts = new Set(rows.map((row) => normalizeToken(row.amount)).filter(Boolean));
  const links = new Set(rows.map((row) => normalizeToken(row.link)).filter(Boolean));

  const conflictFields = [];
  if (deadlines.size > 1) conflictFields.push('deadline');
  if (amounts.size > 1) conflictFields.push('amount');
  if (links.size > 1) conflictFields.push('link');

  return conflictFields;
}

async function main() {
  const args = parseArgs();
  const root = resolve(process.cwd());
  const seedPath = resolve(root, args.seedPath);
  const reportPath = resolve(root, args.reportPath);

  const raw = await readFile(seedPath, 'utf8');
  const seed = JSON.parse(raw);
  if (!Array.isArray(seed)) {
    throw new Error('Seed file must contain an array of bursaries');
  }

  const grouped = new Map();
  for (const row of seed) {
    const key = groupKey(row);
    const bucket = grouped.get(key) || [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const conflicts = [];

  for (const [key, rows] of grouped.entries()) {
    if (rows.length < 2) continue;

    const conflictFields = detectConflict(rows);
    if (conflictFields.length === 0) continue;

    const sourceIds = [...new Set(rows.map((row) => row.verificationSource || 'unknown'))];
    const ids = rows.map((row) => row.id);

    conflicts.push({
      key,
      ids,
      sourceIds,
      conflictFields,
      sample: rows.map((row) => ({
        id: row.id,
        deadline: row.deadline,
        amount: row.amount,
        link: row.link,
      })),
    });

    if (args.apply) {
      for (const row of rows) {
        row.needsReview = true;
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalRecords: seed.length,
    conflictCount: conflicts.length,
    apply: args.apply,
    conflicts,
  };

  if (args.apply) {
    await writeFile(seedPath, JSON.stringify(seed, null, 2), 'utf8');
  }

  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Reconciliation complete. Conflicts: ${conflicts.length}.`);
  console.log(`Report written to ${args.reportPath}`);
  if (args.apply) {
    console.log(`Updated seed file: ${args.seedPath}`);
  }
}

main().catch((error) => {
  console.error('Reconciliation job failed:', error);
  process.exit(1);
});
