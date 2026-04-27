import { readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const DEFAULT_MAX_KB = 500;
const DEFAULT_ASSETS_PATH = ['dist', 'assets'];

function parseArgs() {
  const args = process.argv.slice(2);
  const maxKbIndex = args.indexOf('--max-kb');
  const assetsIndex = args.indexOf('--assets');

  const maxKb =
    maxKbIndex >= 0 && args[maxKbIndex + 1]
      ? Number(args[maxKbIndex + 1])
      : DEFAULT_MAX_KB;

  return {
    maxBytes: Number.isFinite(maxKb) && maxKb > 0 ? Math.floor(maxKb * 1024) : DEFAULT_MAX_KB * 1024,
    assetsPath: assetsIndex >= 0 && args[assetsIndex + 1] ? args[assetsIndex + 1] : DEFAULT_ASSETS_PATH.join('/'),
  };
}

async function main() {
  const args = parseArgs();
  const root = resolve(process.cwd());
  const assetsDir = resolve(root, args.assetsPath);

  const files = await readdir(assetsDir);
  const jsFiles = files.filter((file) => file.endsWith('.js'));

  if (jsFiles.length === 0) {
    throw new Error(`No JS assets found in ${args.assetsPath}`);
  }

  const violations = [];

  for (const file of jsFiles) {
    const filePath = resolve(assetsDir, file);
    const info = await stat(filePath);

    if (info.size > args.maxBytes) {
      violations.push({ file, bytes: info.size });
    }
  }

  console.log(`Bundle budget check: ${jsFiles.length} JS asset(s), max ${(args.maxBytes / 1024).toFixed(0)}KB each.`);

  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(`Budget exceeded: ${violation.file} is ${(violation.bytes / 1024).toFixed(1)}KB`);
    }
    process.exit(1);
  }

  console.log('Bundle budget passed.');
}

main().catch((error) => {
  console.error('Bundle budget check failed:', error);
  process.exit(1);
});
