#!/usr/bin/env node
// Detects <Box onClick={...}> elements that lack the WCAG 2.1.1 keyboard a11y
// triplet (role="button", tabIndex numérico, onKeyDown). Multi-line aware.
//
// Output: one violation per line, format `path:line: missing [...] — <snippet>`.
// Exit 0 if no violations, exit 1 otherwise.
//
// This replaces the single-line AWK heuristic in checks.mjs (guard 305/R7), which
// failed on JSX spanning multiple lines — the common real-world case.
//
// Why a hand-rolled tag scanner instead of a single regex:
//   A naive `<Box[^>]*?>` (or `[^<>]`) breaks on the very thing we need to parse —
//   arrow functions (`onClick={() => ...}`) and nested JSX expressions contain `>`
//   and `{}`, so the match terminates early and produces false positives/negatives.
//   We instead walk from each `<Box` and track `{}`/`[]`/`()` nesting and string
//   literals to find the REAL end of the opening tag.

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
// (the `<` of `<Box`). Returns the index of the closing `>` (for `/>` it's the `>`),
// or -1 if no balanced close is found. Tracks string literals and {}/[]/() nesting
// so that `=>`, JSX expressions and object/array literals don't terminate early.
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

// Match the START of a `<Box` opening tag: `<Box` followed by whitespace or `>`.
// `\b` would also match `<BoxFoo`, so we assert the next char is not an identifier char.
const BOX_START_RE = /<Box(?![A-Za-z0-9_])/g;

const violations = [];

for (const file of walk(componentsDir)) {
  const rel = file.replace(repoRoot + '/', '');
  if (rel.includes('/test/') || rel.includes('__tests__')) continue;

  const source = readFileSync(file, 'utf8');

  let match;
  BOX_START_RE.lastIndex = 0;
  while ((match = BOX_START_RE.exec(source)) !== null) {
    const startIdx = match.index;
    const endIdx = findTagEnd(source, startIdx);
    if (endIdx === -1) continue;

    const tag = source.slice(startIdx, endIdx + 1);

    // Only care about clickable boxes.
    if (!/\bonClick\s*=/.test(tag)) continue;
    // Explicit opt-out.
    if (/guard:exempt/.test(tag)) continue;

    const hasRole = /\brole\s*=\s*\{?\s*["']button["']/.test(tag);
    const hasTabIndex = /\btabIndex\s*=\s*\{?\s*-?\d+\s*\}?/.test(tag);
    const hasKeyDown = /\bonKeyDown\s*=/.test(tag);

    if (!hasRole || !hasTabIndex || !hasKeyDown) {
      const ln = lineNumber(source, startIdx);
      const missing = [
        !hasRole && 'role="button"',
        !hasTabIndex && 'tabIndex',
        !hasKeyDown && 'onKeyDown',
      ]
        .filter(Boolean)
        .join(', ');
      violations.push(`${rel}:${ln}: missing [${missing}] — ${summarize(tag)}`);
    }

    // Continue scanning AFTER this tag's close to avoid re-matching inner boxes twice.
    BOX_START_RE.lastIndex = endIdx + 1;
  }
}

for (const v of violations) console.log(v);
process.exit(violations.length === 0 ? 0 : 1);
