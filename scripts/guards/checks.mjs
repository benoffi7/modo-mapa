// Guard rules registry. Each guard maps to docs/reference/guards/<id>-<slug>.md.
// Each rule has a shell command that prints one violation per line (ideally
// `path:line:match` from grep). The command's stdout line count = violation count.
// Exit code is ignored — we count lines.

export const guards = [
  // ============================================================
  // 300 — Security
  // ============================================================
  {
    id: '300',
    name: 'security',
    docPath: 'docs/reference/guards/300-security.md',
    rules: [
      {
        id: 'R1',
        desc: 'onCall sin enforceAppCheck',
        cmd: `grep -rEn "^export const \\w+ = onCall" functions/src --include="*.ts" -A 8 | grep -B 1 "async (" | grep -v "enforceAppCheck" | grep "onCall" || true`,
      },
      {
        id: 'R6-users-read',
        desc: 'users read permisivo (allow read: if request.auth != null;)',
        cmd: `grep -n "allow read: if request.auth != null;" firestore.rules || true`,
      },
      {
        id: 'R12-feedback-message',
        desc: 'feedback.message sin "is string" guard',
        // Heuristic: in the feedback create rule, there must be a `message is string` check.
        // We grep the rule block for `message is string`; if 0 matches, regression.
        // Output the match (or absence) — we want the count of MISSING.
        cmd: `awk '/match \\/feedback\\/{docId}/,/^}/' firestore.rules | grep -q "message is string" || echo "firestore.rules: missing 'message is string' in feedback create rule"`,
      },
      {
        id: 'R12-notifications-read',
        desc: 'notifications.read update sin "is bool" guard',
        cmd: `awk '/match \\/notifications\\/{notifId}/,/^  }/' firestore.rules | grep -q "read is bool" || echo "firestore.rules: missing 'read is bool' in notifications update rule"`,
      },
      {
        id: 'R12-locality-range',
        desc: 'localityLat/Lng sin range check',
        cmd: `grep -n "localityLat\\|localityLng" firestore.rules | grep -v ">=\\|<=" | grep -v "^[^:]*://" || true`,
      },
      {
        id: 'R12-displayNameLower',
        desc: 'displayNameLower sin equality check vs displayName.lower()',
        cmd: `awk '/match \\/users\\/{userId}/,/allow update/' firestore.rules | grep -q "displayNameLower == request.resource.data.displayName.lower()" || echo "firestore.rules: missing displayNameLower equality check in users create rule"`,
      },
      {
        id: 'R14-bootstrap-admin',
        desc: 'setAdminClaim bootstrap path sin gate (config/bootstrap.adminAssigned)',
        cmd: `grep -n "isBootstrap\\|bootstrap" functions/src/admin/claims.ts | grep -q "adminAssigned" || echo "functions/src/admin/claims.ts: bootstrap path missing config/bootstrap.adminAssigned gate"`,
      },
    ],
  },

  // ============================================================
  // 301 — Coverage
  // ============================================================
  {
    id: '301',
    name: 'coverage',
    docPath: 'docs/reference/guards/301-coverage.md',
    rules: [
      {
        id: 'R2-services-without-test',
        desc: 'services sin test sibling',
        cmd: `for f in src/services/*.ts; do case "$f" in *.test.ts|*.d.ts) continue ;; esac; t="\${f%.ts}.test.ts"; [ ! -f "$t" ] && echo "$f"; done`,
      },
      {
        id: 'R3-triggers-without-test',
        desc: 'triggers sin test entry',
        cmd: `for f in functions/src/triggers/*.ts; do case "$f" in *.test.ts) continue ;; esac; n=$(basename "$f" .ts); t="functions/src/__tests__/triggers/\${n}.test.ts"; [ ! -f "$t" ] && echo "$f -> $t"; done`,
      },
      {
        id: 'R4-admin-callables-without-test',
        desc: 'admin callables sin test entry',
        cmd: `for f in functions/src/admin/*.ts; do case "$f" in *.test.ts|*/index.ts) continue ;; esac; n=$(basename "$f" .ts); t="functions/src/admin/__tests__/\${n}.test.ts"; [ ! -f "$t" ] && echo "$f -> $t"; done`,
      },
      {
        id: 'R5-hooks-without-test',
        desc: 'hooks con logica sin test sibling',
        cmd: `for f in src/hooks/*.ts src/hooks/*.tsx; do case "$f" in *.test.ts|*.test.tsx|*.d.ts) continue ;; esac; [ ! -f "$f" ] && continue; head -1 "$f" | grep -q "// pure-proxy" && continue; t1="\${f%.ts}.test.ts"; t2="\${f%.tsx}.test.tsx"; [ ! -f "$t1" ] && [ ! -f "$t2" ] && echo "$f"; done`,
      },
      {
        id: 'R6-validators-without-test',
        desc: 'validators security-adjacent en utils/ sin test',
        cmd: `for f in src/utils/*.ts; do case "$f" in *.test.ts|*.d.ts) continue ;; esac; if grep -qE "isValid|validate|parseUrl|sanitize|isAllowed" "$f"; then t="\${f%.ts}.test.ts"; [ ! -f "$t" ] && echo "$f"; fi; done`,
      },
      {
        id: 'R-threshold-not-reduced',
        desc: 'vitest threshold accidentalmente reducido (debe ser branches >= 80)',
        cmd: `grep -n "branches:" vitest.config.ts functions/vitest.config.ts | awk -F: '{ for (i=1; i<=NF; i++) if ($i ~ /branches/) { gsub(/[^0-9]/, "", $(i+1)); if ($(i+1) != "" && $(i+1) < 80) print $0 } }' || true`,
      },
    ],
  },

  // ============================================================
  // 302 — Performance
  // ============================================================
  {
    id: '302',
    name: 'performance',
    docPath: 'docs/reference/guards/302-performance.md',
    rules: [
      {
        id: 'R4-allBusinesses-find',
        desc: 'allBusinesses.find() — usar getBusinessMap()',
        cmd: `grep -rn "allBusinesses\\.find" src/ --include="*.ts" --include="*.tsx" || true`,
      },
      {
        id: 'R-stats-barrel',
        desc: 'stats barrel re-exporta PieChartCard como runtime',
        cmd: `grep -n "export.*PieChartCard" src/components/stats/index.ts | grep -v "export type" || true`,
      },
      {
        id: 'R-fetchUserLikes-removed',
        desc: 'fetchUserLikes legacy debe estar eliminado',
        cmd: `grep -rn "fetchUserLikes" src/ --include="*.ts" --include="*.tsx" || true`,
      },
      {
        id: 'R-newMap-allBusinesses',
        desc: 'construccion manual de Map(allBusinesses) fuera de utils/businessMap',
        cmd: `grep -rn "new Map(allBusinesses" src/ --include="*.ts" --include="*.tsx" | grep -v "src/utils/businessMap.ts" || true`,
      },
      {
        id: 'R6-img-without-lazy',
        desc: '<img> remoto sin loading="lazy"',
        cmd: `grep -rn "<img" src/components/ --include="*.tsx" | grep -v "loading=\\"lazy\\"" | grep -v "loading={lazy" | grep -v "test" || true`,
      },
      {
        id: 'R7-mui-icons-not-split',
        desc: 'manualChunks no separa @mui/icons-material',
        cmd: `grep -q "mui-icons" vite.config.ts && grep -q "mui-core" vite.config.ts || echo "vite.config.ts: manualChunks no separa mui-core de mui-icons"`,
      },
      {
        id: 'R8-firebase-storage-in-critical',
        desc: 'firebase/storage en chunk critico de firebase',
        cmd: `awk "/'firebase':/,/]/" vite.config.ts | grep "firebase/storage" || true`,
      },
    ],
  },

  // ============================================================
  // 303 — Perf instrumentation
  // ============================================================
  {
    id: '303',
    name: 'perf-instrumentation',
    docPath: 'docs/reference/guards/303-perf-instrumentation.md',
    rules: [
      {
        id: 'R1-services-raw-getDocs',
        desc: 'getDocs/getDoc crudos en src/services/ (no admin) sin measuredGet*',
        cmd: `grep -rn "getDocs\\|getDoc(" src/services/ --include="*.ts" | grep -v admin | grep -v test | grep -v measuredGet | grep -v "// guard:exempt" || true`,
      },
      {
        id: 'R5-scheduled-without-timing',
        desc: 'scheduled functions sin trackFunctionTiming',
        cmd: `for f in functions/src/scheduled/*.ts; do case "$f" in *.test.ts) continue ;; esac; grep -q "trackFunctionTiming" "$f" || echo "$f"; done`,
      },
      {
        id: 'R6-callable-without-timing',
        desc: 'callable functions sin trackFunctionTiming',
        cmd: `for f in functions/src/callable/*.ts; do case "$f" in *.test.ts) continue ;; esac; grep -q "trackFunctionTiming" "$f" || echo "$f"; done`,
      },
    ],
  },

  // ============================================================
  // 304 — Offline
  // ============================================================
  {
    id: '304',
    name: 'offline',
    docPath: 'docs/reference/guards/304-offline.md',
    rules: [
      {
        id: 'R1-mutations-without-offline',
        desc: 'addDoc/setDoc/updateDoc en services sin withOfflineSupport',
        // Match real call expressions (with `(`), not `import` lines or comments.
        cmd: `grep -rEn "(^|[^a-zA-Z_])(addDoc|setDoc|updateDoc|deleteDoc)\\(" src/services/ --include="*.ts" | grep -v admin | grep -v test | grep -v withOfflineSupport | grep -v "// guard:exempt" || true`,
      },
      {
        id: 'R2-httpsCallable-without-guard',
        desc: 'httpsCallable sin offline guard en components/services',
        cmd: `grep -rn "httpsCallable" src/components/ src/services/ --include="*.ts" --include="*.tsx" | grep -v admin | grep -v test | grep -v "navigator.onLine" | grep -v "isOffline" | grep -v "// guard:exempt" || true`,
      },
      {
        id: 'R3-getCountFromServer-without-wrapper',
        desc: 'getCountFromServer sin getCountOfflineSafe',
        cmd: `grep -rn "getCountFromServer" src/ --include="*.ts" | grep -v test | grep -v getCountOfflineSafe || true`,
      },
      {
        id: 'R5-APIProvider-without-boundary',
        desc: 'APIProvider sin MapErrorBoundary cercano',
        // Each component using APIProvider must show MapErrorBoundary near it.
        cmd: `for f in $(grep -rln "APIProvider" src/components/ --include="*.tsx"); do grep -q "MapErrorBoundary" "$f" || echo "$f"; done`,
      },
    ],
  },

  // ============================================================
  // 305 — UI/UX
  // ============================================================
  {
    id: '305',
    name: 'ui-ux',
    docPath: 'docs/reference/guards/305-ui-ux.md',
    rules: [
      {
        id: 'R1-typography-props',
        desc: 'primaryTypographyProps/secondaryTypographyProps (MUI 6 legacy)',
        cmd: `grep -rn "primaryTypographyProps\\|secondaryTypographyProps" src/ --include="*.tsx" || true`,
      },
      {
        id: 'R3-tabbar-mui-selector',
        desc: 'TabBar MuiBox-root selector fragil',
        cmd: `grep -rn "\\.Mui-selected .MuiBox-root\\|& .MuiBox-root" src/components/layout/ --include="*.tsx" || true`,
      },
      {
        id: 'R4-eslint-disable-react-hooks',
        desc: 'eslint-disable react-hooks en components',
        cmd: `grep -rn "eslint-disable.*react-hooks" src/components/ || true`,
      },
      {
        id: 'R5-chip-height-adhoc',
        desc: 'Chip con height ad-hoc (debe usar CHIP_SMALL_SX)',
        cmd: `grep -rn "<Chip" src/components/ --include="*.tsx" -A 5 | grep "height:" | grep -v "test" || true`,
      },
      {
        id: 'R7-box-onclick-without-a11y',
        desc: '<Box onClick> sin role/tabIndex/onKeyDown a11y triplet',
        // Heuristic: any Box with onClick that is not also showing role="button"+tabIndex within next 3 lines.
        cmd: `for hit in $(grep -rln "Box[^>]*onClick" src/components/ --include="*.tsx"); do awk '/<Box[^>]*onClick/{ flag=1; ctx=""; next } flag && /role="button"/ { flag=0 } flag { ctx=ctx $0 } /<\\/Box>/ && flag { print FILENAME": "$0; flag=0 }' "$hit" 2>/dev/null; done | head -50 || true`,
      },
      {
        id: 'R8-chip-small-sx-exists',
        desc: 'CHIP_SMALL_SX no exportado desde theme/cards.ts',
        cmd: `grep -q "export.*CHIP_SMALL_SX" src/theme/cards.ts || echo "src/theme/cards.ts: missing export of CHIP_SMALL_SX"`,
      },
    ],
  },

  // ============================================================
  // 306 — Architecture
  // ============================================================
  {
    id: '306',
    name: 'architecture',
    docPath: 'docs/reference/guards/306-architecture.md',
    rules: [
      {
        id: 'R1-console-bypass',
        desc: 'console.error/log/warn fuera de logger.ts/sentry.ts',
        cmd: `grep -rn "console\\.\\(error\\|log\\|warn\\)(" src/ --include="*.ts" --include="*.tsx" | grep -v logger.ts | grep -v sentry.ts | grep -v test || true`,
      },
      {
        id: 'R2-file-size-400',
        desc: 'archivos en src/ > 400 LOC (excepto exenciones DEV y tests)',
        cmd: `find src -name "*.tsx" -not -name "*.test.tsx" -not -name "*.test.ts" -exec wc -l {} \\; | awk '$1 > 400 {print}' | grep -v "ConstantsDashboard\\|ThemePlayground" || true`,
      },
      {
        id: 'R5-firestore-in-components',
        desc: "components importan 'firebase/firestore' directamente",
        cmd: `grep -rn "from 'firebase/firestore'" src/components/ || true`,
      },
    ],
  },

  // ============================================================
  // 307 — Dark mode
  // ============================================================
  {
    id: '307',
    name: 'dark-mode',
    docPath: 'docs/reference/guards/307-dark-mode.md',
    rules: [
      {
        id: 'R1-hex-in-sx',
        desc: 'hex literals en sx.color/bgcolor en components/ (excepto ColorPicker)',
        cmd: `grep -rEn "(color|bgcolor|backgroundColor): *['\\"\`]#[0-9a-fA-F]" src/components/ --include="*.tsx" | grep -v ColorPicker | grep -v test | grep -v admin || true`,
      },
      {
        id: 'R2-rgba-white-fixed',
        desc: 'rgba(255,...) blanco fijo en components/',
        cmd: `grep -rn "rgba(255" src/components/ --include="*.tsx" | grep -v admin | grep -v test || true`,
      },
      {
        id: 'R4-mui-fab-mode-aware',
        desc: 'MuiFab override no branchea por mode/isLight',
        cmd: `grep -A 20 "MuiFab" src/theme/index.ts | grep -q "isLight\\|mode === 'dark'" || echo "src/theme/index.ts: MuiFab override missing mode-aware shadow"`,
      },
    ],
  },

  // ============================================================
  // 308 — Privacy
  // ============================================================
  {
    id: '308',
    name: 'privacy',
    docPath: 'docs/reference/guards/308-privacy.md',
    rules: [
      {
        id: 'R-sentry-mention',
        desc: 'PrivacyPolicy menciona Sentry',
        cmd: `grep -q "Sentry\\|sentry" src/components/profile/PrivacyPolicy.tsx || echo "src/components/profile/PrivacyPolicy.tsx: missing Sentry mention"`,
      },
      {
        id: 'R-maps-mention',
        desc: 'PrivacyPolicy menciona mapa/tile providers',
        cmd: `grep -q "mapa\\|tile\\|Google Maps\\|OpenStreetMap" src/components/profile/PrivacyPolicy.tsx || echo "src/components/profile/PrivacyPolicy.tsx: missing maps mention"`,
      },
      // Cross-cutting tests cubren FeedbackCategory + mediaType (vitest test).
    ],
  },

  // ============================================================
  // 309 — Copy
  // ============================================================
  {
    id: '309',
    name: 'copy',
    docPath: 'docs/reference/guards/309-copy.md',
    rules: [
      {
        id: 'R2-tildes-prohibidas',
        desc: 'tildes faltantes / variantes prohibidas (leidas, Mas seguidos, Distribucion, etc.)',
        cmd: `grep -rEn "\\b(leidas|Mas seguidos|Distribucion|Auditorias|Sorpresa|Sorpréndeme)\\b" src/ --include="*.tsx" --include="*.ts" | grep -v test | grep -v "Sorpresa\\!.*onboarding" || true`,
      },
      {
        id: 'R-cerrar-hardcoded',
        desc: "'Cerrar' hardcodeado en components",
        cmd: `grep -rn "'Cerrar'" src/components/ --include="*.tsx" | grep -v MSG_COMMON | grep -v test || true`,
      },
    ],
  },

  // ============================================================
  // 310 — Admin metrics
  // ============================================================
  {
    id: '310',
    name: 'admin-metrics',
    docPath: 'docs/reference/guards/310-admin-metrics.md',
    rules: [
      // Cross-cutting test cubre eventos analytics no registrados en GA4_EVENT_NAMES.
      // Aca solo dejamos un placeholder para servicios admin huerfanos.
      {
        id: 'R3-orphan-admin-services',
        desc: 'admin services exports sin consumer',
        // Heuristic: list named exports in src/services/admin/, check none match in components/admin/
        cmd: `for f in src/services/admin/*.ts; do case "$f" in *.test.ts|*/index.ts) continue ;; esac; grep -oE "^export (async )?(function|const) [a-zA-Z_][a-zA-Z0-9_]*" "$f" | awk '{print $NF}' | while read sym; do [ -z "$sym" ] && continue; grep -rln "\\b$sym\\b" src/components/admin/ >/dev/null || echo "$f::$sym"; done; done`,
      },
    ],
  },

  // ============================================================
  // 311 — Help docs
  // ============================================================
  {
    id: '311',
    name: 'help-docs',
    docPath: 'docs/reference/guards/311-help-docs.md',
    rules: [
      {
        id: 'R1-helpgroups-coverage',
        desc: 'ids en helpGroups.tsx sin mencion en features.md (slug o version humana)',
        // For each id: try slug literal (inicio), or replace _ with space (primeros_pasos -> primeros pasos),
        // or strip prefixes/suffixes commonly used in slugs. Match anywhere in features.md (case-insensitive).
        cmd: `for id in $(grep -oP "id:\\s*'\\K[a-z_-]+" src/components/profile/helpGroups.tsx 2>/dev/null); do human=$(echo "$id" | tr '_' ' '); grep -qiE "\\b($id|$human)\\b" docs/reference/features.md || echo "MISSING in features.md: $id (looked for '$id' and '$human')"; done`,
      },
    ],
  },
];

export const guardById = Object.fromEntries(guards.map((g) => [g.id, g]));
