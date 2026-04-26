#!/usr/bin/env node
// Detects <Box onClick={...}> elements that lack the WCAG 2.1.1 keyboard a11y
// triplet (role="button", tabIndex, onKeyDown). Multi-line aware.
//
// Output: one violation per line, format `path:line:summary`.
// Exit 0 if no violations, exit 1 otherwise.
//
// This complements the AWK heuristic in checks.mjs which fails on multi-line JSX.

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

// Match `<Box ... onClick=... ... >` or `<Box ... ... onClick=... ... />` across multiple lines.
// We use a non-greedy match between `<Box` and the closing `>` (or `/>`).
// We restrict to JSX-like opening tags (the next char after Box must be space, newline, or `>`).
const BOX_OPEN_RE = /<Box(?:\s[^<>]*?)?>/gs;

function lineNumber(source, index) {
  // Count newlines up to index.
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function summarize(snippet) {
  // Single-line snippet for output, max 80 chars.
  const oneLine = snippet.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? oneLine.slice(0, 77) + '...' : oneLine;
}

const violations = [];

for (const file of walk(componentsDir)) {
  const rel = file.replace(repoRoot + '/', '');
  const source = readFileSync(file, 'utf8');

  // Skip generated, mock, or dev-only files conservatively. We don't have many.
  if (rel.includes('/test/') || rel.includes('__tests__')) continue;

  let match;
  BOX_OPEN_RE.lastIndex = 0;
  while ((match = BOX_OPEN_RE.exec(source)) !== null) {
    const tag = match[0];

    // Filter: must contain onClick=
    if (!/\bonClick\s*=/.test(tag)) continue;

    // Skip if explicit guard:exempt comment is in the tag
    if (/guard:exempt/.test(tag)) continue;

    // Check the a11y triplet
    const hasRole = /role\s*=\s*["']button["']/.test(tag);
    const hasTabIndex = /\btabIndex\s*=\s*\{?\s*-?\d+\s*\}?/.test(tag);
    const hasKeyDown = /\bonKeyDown\s*=/.test(tag);

    if (!hasRole || !hasTabIndex || !hasKeyDown) {
      const ln = lineNumber(source, match.index);
      const missing = [
        !hasRole && 'role="button"',
        !hasTabIndex && 'tabIndex',
        !hasKeyDown && 'onKeyDown',
      ]
        .filter(Boolean)
        .join(', ');
      violations.push(`${rel}:${ln}: missing [${missing}] — ${summarize(tag)}`);
    }
  }
}

for (const v of violations) console.log(v);
process.exit(violations.length === 0 ? 0 : 1);
