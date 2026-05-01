#!/usr/bin/env bash
# Pre-staging checklist — run before deploying to staging.
# Exit code 1 if any check fails.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
FAIL=0
CHECKS_RUN=0
CHECKS_PASSED=0

pass() { echo "  ✅ PASS: $1"; CHECKS_PASSED=$((CHECKS_PASSED + 1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=1; }
check() { CHECKS_RUN=$((CHECKS_RUN + 1)); }

echo "=== Pre-staging checklist ==="
echo ""

# ---------- 1. TypeScript compilation for functions (if changed) ----------
check
echo "1) Functions TypeScript compilation"
if git diff origin/main -- functions/src/ functions/package.json 2>/dev/null | grep -q .; then
  if (cd "$REPO_ROOT/functions" && npm ci --ignore-scripts 2>/dev/null && npx tsc --noEmit 2>&1); then
    pass "functions compile cleanly"
  else
    echo "  ⚠️  WARN: functions TypeScript errors (non-blocking — tested in functions-test job)"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
  fi
else
  pass "functions unchanged — skipped"
fi

# ---------- 2. No enforceAppCheck: !IS_EMULATOR ----------
check
echo "2) No 'enforceAppCheck: !IS_EMULATOR' (should be ENFORCE_APP_CHECK)"
MATCHES=$(grep -rn 'enforceAppCheck:\s*!IS_EMULATOR' "$REPO_ROOT/functions/src/" 2>/dev/null || true)
if [ -z "$MATCHES" ]; then
  pass "no bad enforceAppCheck pattern found"
else
  echo "$MATCHES"
  fail "found enforceAppCheck: !IS_EMULATOR — use ENFORCE_APP_CHECK instead"
fi

# ---------- 3. No getFirestore() without getDb() ----------
check
echo "3) No raw getFirestore() in functions/src (excluding helpers/env.ts and tests)"
MATCHES=$(grep -rn 'getFirestore()' "$REPO_ROOT/functions/src/" \
  --include='*.ts' \
  | grep -v '__tests__' \
  | grep -v 'helpers/env.ts' \
  || true)
if [ -z "$MATCHES" ]; then
  pass "no raw getFirestore() calls"
else
  echo "$MATCHES"
  fail "use getDb() instead of getFirestore()"
fi

# ---------- 4. No silent .catch(() => {}) in src/ ----------
check
echo "4) No silent .catch(() => {}) in src/"
MATCHES=$(grep -rn '\.catch(()' "$REPO_ROOT/src/" \
  --include='*.ts' --include='*.tsx' \
  | grep -v '__tests__' \
  | grep -v '\.test\.' \
  || true)
if [ -z "$MATCHES" ]; then
  pass "no silent catch handlers"
else
  echo "$MATCHES"
  fail "replace silent .catch(() => {}) with console.error logging"
fi

# ---------- 5. No 'as never' in production code ----------
check
echo "5) No 'as never' in non-test production code"
MATCHES=$(grep -rn 'as never' "$REPO_ROOT/src/" \
  --include='*.ts' --include='*.tsx' \
  | grep -v '__tests__' \
  | grep -v '\.test\.' \
  || true)
if [ -z "$MATCHES" ]; then
  pass "no 'as never' in production code"
else
  echo "$MATCHES"
  fail "avoid 'as never' in production code"
fi

# ---------- 6. Service-layer Firestore reads instrumented (#325 S5) ----------
# Every getDoc(/getDocs( in src/services/ should be wrapped via
# measuredGetDoc / measuredGetDocs / measureAsync. Calls intentionally
# left raw (e.g. inside an already-measured Promise.all) MUST carry
# the marker comment `// perf-instrument-ok` on the same or previous line.
#
# src/services/admin/ is excluded — admin-only queries are infrequent,
# behind isAdmin() rules, and out of scope for the user-facing perf
# instrumentation effort tracked in #325.
check
echo "6) Service-layer Firestore reads instrumented (#325)"
RAW_HITS=""
while IFS=: read -r file line content; do
  # Skip if same line uses the wrapper.
  if echo "$content" | grep -qE 'measured(GetDoc|GetDocs)\(|measureAsync\('; then
    continue
  fi
  # Skip if marker on same line or up to 2 previous lines (allow Promise.all/arrow wrapping)
  if echo "$content" | grep -q 'perf-instrument-ok'; then
    continue
  fi
  marker_found=0
  for back in 1 2; do
    prev_line=$((line - back))
    if [ "$prev_line" -ge 1 ] && sed -n "${prev_line}p" "$file" 2>/dev/null | grep -q 'perf-instrument-ok'; then
      marker_found=1
      break
    fi
  done
  if [ "$marker_found" -eq 1 ]; then
    continue
  fi
  # Skip import lines (these declare getDoc/getDocs from firestore SDK)
  if echo "$content" | grep -qE "^import .* from 'firebase/firestore'"; then
    continue
  fi
  if echo "$content" | grep -qE '^\s*(getDoc|getDocs),?\s*$'; then
    # Multi-line import member
    continue
  fi
  RAW_HITS="$RAW_HITS$file:$line:$content"$'\n'
done < <(grep -rn -E '\b(getDoc|getDocs)\(' "$REPO_ROOT/src/services/" --include='*.ts' 2>/dev/null \
  | grep -v '/admin/' \
  || true)

if [ -z "$RAW_HITS" ]; then
  pass "all src/services/ Firestore reads are wrapped (or carry perf-instrument-ok marker)"
else
  echo "$RAW_HITS"
  fail "raw getDoc()/getDocs() in src/services/ — wrap with measuredGetDoc/measuredGetDocs/measureAsync, or add '// perf-instrument-ok' marker"
fi

# ---------- Summary ----------
echo ""
echo "=== Summary: $CHECKS_PASSED/$CHECKS_RUN checks passed ==="
if [ "$FAIL" -ne 0 ]; then
  echo "❌ Pre-staging check FAILED"
  exit 1
else
  echo "✅ All checks passed"
  exit 0
fi
