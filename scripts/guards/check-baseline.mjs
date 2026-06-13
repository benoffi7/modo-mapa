#!/usr/bin/env node
// Compares current guard violations against .guards-baseline.json.
//
// Usage:
//   node scripts/guards/check-baseline.mjs        # check, exit 1 if any guard regressed
//   node scripts/guards/check-baseline.mjs --update  # update baseline (only DOWNWARD)
//
// Baseline format: { "<guardId>": { "<ruleId>": <count> }, "_total": <number> }
//
// Rules:
// - PR/push fails if any rule's count INCREASED vs baseline.
// - PR/push fails (with helpful message) if a rule REDUCED — author must run --update.
// - Use --update to lock in lower numbers as the new ceiling.

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guards } from './checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const baselinePath = resolve(repoRoot, '.guards-baseline.json');

const args = process.argv.slice(2);
const updateMode = args.includes('--update');
const forceMode = args.includes('--force');
const quiet = args.includes('--quiet');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function log(...a) { if (!quiet) console.log(...a); }
function warn(...a) { console.error(...a); }

// Run all guards, collect counts per (guardId, ruleId).
const current = {};
let total = 0;

for (const guard of guards) {
  current[guard.id] = {};
  for (const rule of guard.rules) {
    let count = 0;
    try {
      const stdout = execSync(rule.cmd, {
        cwd: repoRoot,
        shell: '/bin/bash',
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      count = stdout.split('\n').filter((l) => l.trim().length > 0).length;
    } catch (err) {
      const stdout = (err.stdout ?? '').toString();
      count = stdout.split('\n').filter((l) => l.trim().length > 0).length;
    }
    current[guard.id][rule.id] = count;
    total += count;
  }
}
current._total = total;

if (updateMode) {
  // Block UPDATE that would raise the ceiling, unless --force.
  if (existsSync(baselinePath) && !forceMode) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
    const raised = [];
    for (const [gid, rules] of Object.entries(current)) {
      if (gid === '_total') continue;
      for (const [rid, count] of Object.entries(rules)) {
        const prev = baseline?.[gid]?.[rid] ?? 0;
        if (count > prev) raised.push(`${gid}/${rid}: ${prev} -> ${count}`);
      }
    }
    if (raised.length > 0) {
      warn(`${RED}Refusing to update baseline — these rules regressed:${RESET}`);
      for (const r of raised) warn(`  ${r}`);
      warn(
        `\nFix the regressions first, then re-run with --update.\n` +
          `Baseline is meant to ratchet DOWN, not UP.\n` +
          `\nIf the check itself changed (new coverage exposing pre-existing debt,\n` +
          `not new violations), use --force with explicit commit message justification.\n`,
      );
      process.exit(2);
    }
  }
  if (forceMode) {
    warn(
      `${YELLOW}--force: bypassing regression check.${RESET} Make sure the commit message\n` +
        `explains WHY (e.g. "rule R7 detection improved — no new violations introduced").\n`,
    );
  }
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n');
  log(`${GREEN}Baseline updated${RESET} — total ${total} violations.`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  warn(`${YELLOW}No baseline at ${baselinePath}.${RESET}`);
  warn(`Run: npm run guards:baseline`);
  warn(`Current totals: ${total} violations across ${guards.length} guards.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
const regressions = [];
const reductions = [];

for (const [gid, rules] of Object.entries(current)) {
  if (gid === '_total') continue;
  for (const [rid, count] of Object.entries(rules)) {
    const prev = baseline?.[gid]?.[rid] ?? 0;
    if (count > prev) regressions.push({ id: `${gid}/${rid}`, prev, count });
    else if (count < prev) reductions.push({ id: `${gid}/${rid}`, prev, count });
  }
}

log(`Guards baseline check — ${new Date().toISOString()}`);
log(`Current total: ${total}  |  Baseline total: ${baseline._total ?? 'unknown'}`);

if (regressions.length === 0 && reductions.length === 0) {
  log(`${GREEN}✓ No drift.${RESET}`);
  process.exit(0);
}

if (regressions.length > 0) {
  warn(`\n${RED}✗ Regressions (rules that grew):${RESET}`);
  for (const r of regressions) {
    warn(`  ${r.id}: ${r.prev} -> ${r.count}  (+${r.count - r.prev})`);
  }
  warn(
    `\n${RED}Push/PR blocked.${RESET} Fix the regressions, or if intentional and unavoidable,\n` +
      `discuss with the team and update the baseline (npm run guards:baseline:update).\n`,
  );
}

if (reductions.length > 0) {
  log(`\n${GREEN}✓ Reductions (rules that shrank):${RESET}`);
  for (const r of reductions) {
    log(`  ${r.id}: ${r.prev} -> ${r.count}  (${DIM}-${r.prev - r.count}${RESET})`);
  }
  log(`\n${YELLOW}Run \`npm run guards:baseline:update\` to lock in the lower ceiling.${RESET}`);
}

process.exit(regressions.length > 0 ? 1 : 0);
