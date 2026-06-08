#!/usr/bin/env node
// Detects <Chip> elements with an ad-hoc `height:` in their `sx` prop instead of
// using the shared CHIP_SMALL_SX token (guard 305/R5, R8). Multi-line aware.
//
// Output: one violation per line, format `path:line: ad-hoc height — <snippet>`.
// Exit 0 if no violations, exit 1 otherwise.
//
// This replaces the single-line `grep "<Chip" -A 5 | grep "height:"` heuristic in
// checks.mjs, which (a) missed chips whose `<Chip` opening and `height:` were more
// than 5 lines apart (e.g. VerificationBadge), and (b) false-positived on sibling
// `<Box sx={{ height: ... }}>` captured inside the -A 5 window (e.g. MyFeedbackList).
//
// Same hand-rolled tag scanner as check-box-onclick.mjs — see that file for why a
// naive regex breaks on `=>`, nested JSX expressions and object/array literals.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');
const componentsDir = resolve(repoRoot, 'src/components');

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) {
      yield full;
    }
  }
}

// Find the index of the `>` that closes the opening tag that starts at `startIdx`
// (the `<` of `<Chip`). Tracks string literals and {}/[]/() nesting so that `=>`,
// JSX expressions and object/array literals don't terminate early.
function findTagEnd(source, startIdx) {
  let depthCurly = 0;
  let depthSquare = 0;
  let depthParen = 0;
  let quote = null; // ', ", ` or null
  for (let i = startIdx; i < source.length; i++) {
    const ch = source[i];
    const prev = source[i - 1];

    if (quote) {
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depthCurly++;
    else if (ch === '}') depthCurly--;
    else if (ch === '[') depthSquare++;
    else if (ch === ']') depthSquare--;
    else if (ch === '(') depthParen++;
    else if (ch === ')') depthParen--;
    else if (
      ch === '>' &&
      prev !== '=' && // skip arrow `=>`
      depthCurly === 0 &&
      depthSquare === 0 &&
      depthParen === 0
    ) {
      return i;
    }
  }
  return -1;
}

function lineNumber(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function summarize(snippet) {
  const oneLine = snippet.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
}

// Match the START of a `<Chip` opening tag: `<Chip` not followed by an identifier
// char (so `<ChipGroup` doesn't match).
const CHIP_START_RE = /<Chip(?![A-Za-z0-9_])/g;

const violations = [];

for (const file of walk(componentsDir)) {
  const rel = file.replace(repoRoot + '/', '');
  if (rel.includes('/test/') || rel.includes('__tests__')) continue;

  const source = readFileSync(file, 'utf8');

  let match;
  CHIP_START_RE.lastIndex = 0;
  while ((match = CHIP_START_RE.exec(source)) !== null) {
    const startIdx = match.index;
    const endIdx = findTagEnd(source, startIdx);
    if (endIdx === -1) continue;

    const tag = source.slice(startIdx, endIdx + 1);

    // Explicit opt-out.
    if (/guard:exempt/.test(tag)) {
      CHIP_START_RE.lastIndex = endIdx + 1;
      continue;
    }
    // Ad-hoc height inside the chip's own opening tag (sx or inline). The shared
    // token CHIP_SMALL_SX encodes the canonical height, so a literal `height:` here
    // is the regression we want.
    if (/\bheight\s*:/.test(tag)) {
      const ln = lineNumber(source, startIdx);
      violations.push(`${rel}:${ln}: ad-hoc height (use CHIP_SMALL_SX) — ${summarize(tag)}`);
    }

    CHIP_START_RE.lastIndex = endIdx + 1;
  }
}

for (const v of violations) console.log(v);
process.exit(violations.length === 0 ? 0 : 1);