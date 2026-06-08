#!/usr/bin/env node
// Bundle-size gate. Measures the raw byte size of key JS chunks in dist/assets/
// and compares them against per-chunk thresholds.
//
// Run AFTER a build:
//   npm run build
//   node scripts/guards/bundle-size.mjs            # warning-only (default)
//   BUNDLE_SIZE_BLOCKING=true node scripts/guards/bundle-size.mjs  # blocker
//
// Or via npm:
//   npm run bundle:check
//
// Modes:
// - Default (warning-only): prints the table, ALWAYS exits 0. A FAIL row is
//   reported as WARN so it never breaks local builds or PRs by accident.
// - Blocking (BUNDLE_SIZE_BLOCKING=true): exits 1 if any chunk exceeds its
//   threshold. Wire this into CI/pre-push once the budgets are trusted.
//
// Thresholds are RAW (uncompressed) bytes — the same number Vite prints before
// "│ gzip:". Initial budgets come from issue #334 (deferrals from #324):
//   mui-core ≤ 500 KB, firebase ≤ 460 KB, index ≤ 320 KB.
//
// Chunk resolution:
// - `mui-core` / `firebase` are manualChunks (see vite.config.ts) → matched by
//   filename prefix `<name>-<hash>.js`.
// - `index` is the app entry. Because Vite can emit more than one `index-*.js`
//   (e.g. a separate Sentry vendor chunk), we resolve the REAL entry from the
//   <script type="module"> tag in dist/index.html instead of prefix-matching.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const distDir = resolve(repoRoot, 'dist');
const assetsDir = resolve(distDir, 'assets');
const indexHtml = resolve(distDir, 'index.html');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const blocking = process.env.BUNDLE_SIZE_BLOCKING === 'true';

const KB = 1024;

// Per-chunk RAW (uncompressed) byte budgets. Keep in sync with
// docs/reference/perf-baselines.md.
const THRESHOLDS = [
  { name: 'mui-core', limitKB: 500, match: 'prefix' },
  { name: 'firebase', limitKB: 460, match: 'prefix' },
  { name: 'index', limitKB: 320, match: 'entry' },
];

function fail(msg) {
  console.error(`${RED}bundle-size gate: ${msg}${RESET}`);
  // A missing build is a setup error, not a budget regression — surface it
  // regardless of mode, but only break the run when blocking.
  process.exit(blocking ? 1 : 0);
}

if (!existsSync(distDir) || !existsSync(assetsDir)) {
  fail(`no build found at ${distDir}. Run \`npm run build\` first.`);
}

// Resolve the app entry chunk from the module script tag in index.html.
function resolveEntryChunk() {
  if (!existsSync(indexHtml)) return null;
  const html = readFileSync(indexHtml, 'utf8');
  const m = html.match(/<script[^>]*type="module"[^>]*src="([^"]+\.js)"/);
  if (!m) return null;
  return basename(m[1]);
}

// Find a hashed chunk by `<name>-<hash>.js` prefix. Returns the largest match
// if several exist (defensive — there should be exactly one per manualChunk).
function findByPrefix(name) {
  const files = readdirSync(assetsDir).filter(
    (f) => f.startsWith(`${name}-`) && f.endsWith('.js') && !f.endsWith('.map'),
  );
  if (files.length === 0) return null;
  return files
    .map((f) => ({ file: f, size: statSync(resolve(assetsDir, f)).size }))
    .sort((a, b) => b.size - a.size)[0].file;
}

const entryChunk = resolveEntryChunk();
const rows = [];
let worst = 'OK'; // OK < WARN < FAIL

for (const t of THRESHOLDS) {
  let file = null;
  if (t.match === 'entry') {
    file = entryChunk && existsSync(resolve(assetsDir, entryChunk)) ? entryChunk : null;
  } else {
    file = findByPrefix(t.name);
  }

  if (!file) {
    rows.push({ name: t.name, file: '(not found)', sizeKB: null, limitKB: t.limitKB, status: 'MISSING' });
    if (worst === 'OK') worst = 'WARN';
    continue;
  }

  const sizeBytes = statSync(resolve(assetsDir, file)).size;
  const sizeKB = sizeBytes / KB;
  const over = sizeKB > t.limitKB;
  // In warning-only mode an over-budget chunk is reported as WARN, not FAIL.
  const status = over ? (blocking ? 'FAIL' : 'WARN') : 'OK';
  if (status === 'FAIL') worst = 'FAIL';
  else if (status === 'WARN' && worst !== 'FAIL') worst = 'WARN';
  rows.push({ name: t.name, file, sizeKB, limitKB: t.limitKB, status });
}

// --- Render table ---
const fmtKB = (kb) => (kb == null ? '—' : `${kb.toFixed(1)} KB`);
const statusColor = { OK: GREEN, WARN: YELLOW, FAIL: RED, MISSING: YELLOW };

const head = `${BOLD}Bundle-size gate${RESET}  ${DIM}(${blocking ? 'BLOCKING' : 'warning-only'}, RAW bytes)${RESET}`;
console.log(`\n${head}\n`);

const col = { chunk: 10, size: 11, limit: 11, status: 7 };
console.log(
  `  ${'chunk'.padEnd(col.chunk)} ${'size'.padStart(col.size)} ${'threshold'.padStart(col.limit)}  status   ${DIM}file${RESET}`,
);
console.log(`  ${'-'.repeat(col.chunk)} ${'-'.repeat(col.size)} ${'-'.repeat(col.limit)}  ${'-'.repeat(col.status)}`);
for (const r of rows) {
  const c = statusColor[r.status] ?? RESET;
  console.log(
    `  ${r.name.padEnd(col.chunk)} ${fmtKB(r.sizeKB).padStart(col.size)} ${(`≤ ${r.limitKB} KB`).padStart(col.limit)}  ${c}${r.status.padEnd(col.status)}${RESET}  ${DIM}${r.file}${RESET}`,
  );
}

console.log('');
if (worst === 'OK') {
  console.log(`${GREEN}✓ All measured chunks within budget.${RESET}\n`);
} else if (!blocking) {
  console.log(
    `${YELLOW}⚠ Some chunks are over budget (warning-only mode — not failing).${RESET}\n` +
      `${DIM}  Set BUNDLE_SIZE_BLOCKING=true to enforce.${RESET}\n`,
  );
} else {
  console.error(
    `${RED}✗ Bundle-size gate failed — chunk(s) over budget.${RESET}\n` +
      `${DIM}  Reduce the chunk, or adjust the threshold in scripts/guards/bundle-size.mjs\n` +
      `  + docs/reference/perf-baselines.md after team discussion.${RESET}\n`,
  );
}

// Warning-only mode always exits 0. Blocking mode fails on FAIL rows.
process.exit(blocking && worst === 'FAIL' ? 1 : 0);
