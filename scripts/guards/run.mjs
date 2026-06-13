#!/usr/bin/env node
// Guard runner. Executes all guard rules and emits a JSON report.
//
// Usage:
//   node scripts/guards/run.mjs              # run all, JSON to stdout
//   node scripts/guards/run.mjs --pretty     # human-readable summary
//   node scripts/guards/run.mjs --guard 302  # filter to one guard id
//   node scripts/guards/run.mjs --rule 302/R4-allBusinesses-find  # filter to one rule
//   node scripts/guards/run.mjs --json       # alias for default
//   node scripts/guards/run.mjs --report-file <path>  # write JSON to file
//
// Exit codes:
//   0 — all guards green
//   1 — at least one rule has violations
//
// This script does not enforce a baseline — that's check-baseline.mjs.

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guards } from './checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const pretty = flag('--pretty');
const guardFilter = value('--guard');
const ruleFilter = value('--rule');
const reportFile = value('--report-file');

function runRule(rule) {
  try {
    const stdout = execSync(rule.cmd, {
      cwd: repoRoot,
      shell: '/bin/bash',
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    return { ok: true, count: lines.length, violations: lines };
  } catch (err) {
    // grep returns non-zero when no match — that means 0 violations. But our cmds
    // are structured to swallow that with `|| true`. Any other non-zero is a real error.
    const stdout = (err.stdout ?? '').toString();
    const stderr = (err.stderr ?? '').toString();
    if (stdout.trim().length === 0 && stderr.trim().length === 0) {
      return { ok: true, count: 0, violations: [] };
    }
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    return {
      ok: false,
      count: lines.length,
      violations: lines,
      error: stderr || `exit ${err.status}`,
    };
  }
}

const report = {
  timestamp: new Date().toISOString(),
  guards: {},
  totals: { violations: 0, rulesViolated: 0, rulesChecked: 0 },
};

for (const guard of guards) {
  if (guardFilter && guard.id !== guardFilter) continue;

  const guardReport = {
    name: guard.name,
    docPath: guard.docPath,
    rules: {},
    totalViolations: 0,
  };

  for (const rule of guard.rules) {
    const ruleKey = `${guard.id}/${rule.id}`;
    if (ruleFilter && ruleKey !== ruleFilter) continue;

    const result = runRule(rule);
    guardReport.rules[rule.id] = {
      desc: rule.desc,
      count: result.count,
      violations: result.violations,
      error: result.error ?? null,
    };
    guardReport.totalViolations += result.count;
    report.totals.rulesChecked += 1;
    if (result.count > 0) report.totals.rulesViolated += 1;
  }

  report.guards[guard.id] = guardReport;
  report.totals.violations += guardReport.totalViolations;
}

if (reportFile) {
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
}

if (pretty) {
  const RED = '\x1b[31m';
  const GREEN = '\x1b[32m';
  const YELLOW = '\x1b[33m';
  const DIM = '\x1b[2m';
  const RESET = '\x1b[0m';

  console.log(`\nGuards report — ${report.timestamp}\n`);
  for (const [id, g] of Object.entries(report.guards)) {
    const tag = g.totalViolations === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`${tag} ${id}-${g.name}  ${g.totalViolations} violations`);
    for (const [ruleId, r] of Object.entries(g.rules)) {
      const ruleTag = r.count === 0 ? `${GREEN}  ✓${RESET}` : `${RED}  ✗${RESET}`;
      const desc = r.desc.length > 70 ? r.desc.slice(0, 67) + '...' : r.desc;
      console.log(`${ruleTag} ${ruleId.padEnd(34)} ${r.count.toString().padStart(4)}  ${DIM}${desc}${RESET}`);
      if (r.count > 0 && r.count <= 5) {
        for (const v of r.violations) {
          console.log(`        ${YELLOW}${v}${RESET}`);
        }
      } else if (r.count > 5) {
        for (const v of r.violations.slice(0, 3)) {
          console.log(`        ${YELLOW}${v}${RESET}`);
        }
        console.log(`        ${DIM}... and ${r.count - 3} more${RESET}`);
      }
    }
  }
  console.log(
    `\n${report.totals.violations === 0 ? GREEN : RED}TOTAL${RESET}: ${report.totals.violations} violations across ${report.totals.rulesViolated}/${report.totals.rulesChecked} rules.`,
  );
} else {
  console.log(JSON.stringify(report, null, 2));
}

process.exit(report.totals.violations === 0 ? 0 : 1);
