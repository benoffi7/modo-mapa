// Guard rules registry. Each guard maps to docs/reference/guards/<id>-<slug>.md.
// Each rule has a shell command that prints one violation per line (ideally
// `path:line:match` from grep). The command's stdout line count = violation count.
// Exit code is ignored — we count lines.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
// Guard 309 — diccionario de tildes (data-driven, no lista cerrada)
// ------------------------------------------------------------------
// `scripts/guards/data/spanish-tildes.json` es la fuente de verdad:
//   - always_tilded: palabras castellanas en su forma CORRECTA (con tilde).
//     Derivamos la forma SIN tilde para grepear el código: cualquier string
//     user-facing con esa variante es una regresión de copy de #309.
//   - whitelist: identificadores TS/JS o palabras inglesas que matchean el
//     patrón sin acento pero NO son castellano (Function, useNavigation, ...).
const tildesDict = JSON.parse(
  readFileSync(resolve(__dirname, 'data/spanish-tildes.json'), 'utf8'),
);

// Quitar acentos: "acción" -> "accion", "más" -> "mas".
function stripAccents(word) {
  return word.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Formas SIN tilde a detectar como regresión, de-duplicadas. Excluimos las que
// colisionan con la whitelist (case-insensitive) para no auto-flaggear FPs.
const whitelistLower = new Set(
  (tildesDict.whitelist ?? []).map((w) => w.toLowerCase()),
);
const untildedTargets = [
  ...new Set(
    (tildesDict.always_tilded ?? [])
      .map((w) => stripAccents(w.toLowerCase()))
      .filter((w) => w.length > 0 && !whitelistLower.has(w)),
  ),
].sort();

// Alternación regex para grep -E, con word boundaries.
const tildesAlternation = untildedTargets.join('|');

// `grep -v` extra para descartar líneas cuyo match real es un token whitelisteado
// (ej. `version`, `Action`, `mas` como identificador). Cada término se filtra
// con su propio word-boundary, case-sensitive (los identifiers conservan su caso).
const whitelistFilter = (tildesDict.whitelist ?? [])
  .map((w) => `grep -vw "${w.replace(/"/g, '\\"')}"`)
  .join(' | ');

// Variantes prohibidas que NO son "falta de tilde" sino formas incorrectas
// (sobre-tildado peninsular, naming legacy). Se conservan del R2 original de #309.
const PROHIBITED_VARIANTS = ['Mas seguidos', 'Sorpresa', 'Sorpréndeme'];

// Comando R2: tildes faltantes según el diccionario + variantes prohibidas.
// Buscamos las formas sin tilde (case-insensitive, word boundary) en strings de
// código, descartamos tests, la línea de onboarding exenta y los tokens whitelist.
const R2_TILDES_CMD =
  `grep -rEnwi "(${tildesAlternation}|${PROHIBITED_VARIANTS.join('|')})" src/ --include="*.tsx" --include="*.ts" ` +
  `| grep -v test ` +
  `| grep -v "Sorpresa\\!.*onboarding" ` +
  (whitelistFilter ? `| ${whitelistFilter} ` : '') +
  `|| true`;

// ------------------------------------------------------------------
// Guard 309 / R3 — heurística de tildes (WARNING, no blocker)
// ------------------------------------------------------------------
// Detecta palabras *cion (>=4 chars, sin tilde) dentro de strings JSX. Sugiere
// promoverlas al diccionario. Filtramos:
//   - whitelist (Function, useNavigation, ...),
//   - palabras *cion ya cubiertas por el diccionario (las flaggea R2; acá solo
//     mostramos NUEVOS candidatos para no duplicar ruido),
//   - tests.
const dictUntildedSet = new Set(untildedTargets);
const dictCionCovered = [...dictUntildedSet].filter((w) => w.endsWith('cion'));
const r3FilterTerms = [
  ...new Set([...(tildesDict.whitelist ?? []), ...dictCionCovered]),
];
const r3Filter = r3FilterTerms
  .map((w) => `grep -viw "${w.replace(/"/g, '\\"')}"`)
  .join(' | ');

const R3_TILDES_HEURISTICA_CMD =
  `grep -rEn "['\\"\\\`][^'\\"\\\`]*\\b[a-zA-ZÀ-ÿ]{4,}cion\\b" src/ --include="*.tsx" --include="*.ts" ` +
  `| grep -v test ` +
  (r3Filter ? `| ${r3Filter} ` : '') +
  `|| true`;

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
      {
        id: 'R15-secrets-in-functions-env',
        desc: 'secrets (ADMIN_EMAIL / APP_CHECK_ENFORCEMENT) commiteados en functions/.env — deben ir a Secret Manager (#342)',
        cmd: `grep -nE "^(ADMIN_EMAIL|APP_CHECK_ENFORCEMENT)=" functions/.env 2>/dev/null || true`,
      },
      {
        id: 'R16-react-router-vulnerable',
        desc: 'react-router-dom < 7.14.2 (advisories RCE/XSS/open-redirect, #342)',
        cmd: `node -e "try{const v=require('./node_modules/react-router-dom/package.json').version;const p=v.split('.').map(Number);if(p[0]<7||(p[0]===7&&(p[1]<14||(p[1]===14&&p[2]<2))))console.log('react-router-dom '+v+' < 7.14.2 (vulnerable)')}catch(e){}" 2>/dev/null || true`,
      },
      {
        id: 'R17-isValidStorageUrl-prefix-only',
        desc: 'isValidStorageUrl valida solo el host (startsWith) sin el segmento /v0/b/<bucket>/o/ (#342)',
        cmd: `grep -q "firebasestorage.googleapis.com" src/utils/media.ts && ! grep -q "v0/b/" src/utils/media.ts && echo "src/utils/media.ts: isValidStorageUrl prefix-only, falta validar el path /v0/b/.../o/" || true`,
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
      {
        id: 'R7-getCount-without-measure',
        desc: 'getCountOfflineSafe en services/ sin measureAsync (latencia invisible al dashboard, #347)',
        // El wrapper getCountOfflineSafe.ts es la definicion (exenta). Los call sites
        // legitimamente envueltos a mayor nivel (rankings) llevan `// guard:exempt`.
        cmd: `grep -rn "getCountOfflineSafe(" src/services/ --include="*.ts" | grep -v test | grep -v "getCountOfflineSafe.ts" | grep -v measureAsync | grep -v "// guard:exempt" || true`,
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
        desc: 'Chip con height ad-hoc (debe usar CHIP_SMALL_SX) — multi-line aware',
        // Multi-line aware Node script. Replaces the single-line `grep -A 5` heuristic
        // which missed chips whose `<Chip` and `height:` were >5 lines apart
        // (VerificationBadge) and false-positived on sibling `<Box height:>` inside
        // the -A 5 window (MyFeedbackList). Opt-out per-tag with `guard:exempt`.
        cmd: `node scripts/guards/lib/check-chip-height.mjs || true`,
      },
      {
        id: 'R9-fab-safe-area',
        desc: 'FAB con position absolute/fixed sin env(safe-area-inset-bottom) — puede quedar tapado por el home indicator',
        cmd: `for f in $(grep -rln "Fab\\|FAB" src/components/ --include="*.tsx" | grep -iv test); do grep -lq "position: 'absolute'\\|position: 'fixed'\\|position:\\"absolute\\"\\|position:\\"fixed\\"" "$f" && grep -q "bottom:" "$f" && ! grep -q "safe-area-inset-bottom\\|guard:exempt" "$f" && echo "$f: FAB con bottom fijo sin safe-area-inset-bottom"; done || true`,
      },
      {
        id: 'R7-box-onclick-without-a11y',
        desc: '<Box onClick> sin role/tabIndex/onKeyDown a11y triplet (multi-line aware)',
        // Multi-line aware Node script — replaces AWK heuristic which failed on JSX spanning lines.
        cmd: `node scripts/guards/lib/check-box-onclick.mjs || true`,
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
        desc: 'tildes faltantes / variantes prohibidas (diccionario data/spanish-tildes.json + variantes legacy)',
        // Data-driven: carga scripts/guards/data/spanish-tildes.json (always_tilded +
        // whitelist). Para agregar palabras, editar el JSON — no este archivo.
        cmd: R2_TILDES_CMD,
      },
      {
        id: 'R3-tildes-heuristica',
        desc: 'WARNING (no blocker): palabras *cion (>=4 chars) en strings JSX que no están en whitelist — candidatas a promover al diccionario',
        // Heurística del issue #331: detecta palabras terminadas en `cion` dentro
        // de strings (comilla simple/doble/backtick) con >=4 chars. El resultado se
        // filtra contra la whitelist y contra las formas ya cubiertas por el
        // diccionario (que ya las flaggea R2), dejando solo NUEVOS candidatos.
        cmd: R3_TILDES_HEURISTICA_CMD,
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
      {
        id: 'R4-ipRateLimits-no-admin-inspector',
        desc: '_ipRateLimits escrito en functions pero sin inspector en src/components/admin (dato huerfano, #348)',
        cmd: `grep -rq "_ipRateLimits" functions/src/ && ! grep -rq "ipRateLimits\\|_ipRateLimits" src/components/admin/ && echo "_ipRateLimits: coleccion de abuso por IP sin inspector admin" || true`,
      },
      {
        id: 'R5-abuse-type-never-emitted',
        desc: 'tipo de abuso ip_rate_limit definido pero nunca emitido por ningun call site (codigo muerto, #348)',
        cmd: `grep -q "ip_rate_limit" functions/src/utils/abuseLogger.ts && [ -z "$(grep -rl "'ip_rate_limit'" functions/src/ | grep -v abuseLogger.ts)" ] && echo "ip_rate_limit: tipo definido en abuseLogger.ts pero nunca emitido (authBlocking usa anon_flood)" || true`,
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
      {
        id: 'R2-features-sidemenu-drift',
        desc: 'features.md describe "SideMenu"/"Menu lateral" pero no existe SideMenu.tsx (la app usa TabBar) — drift de la fuente de verdad (#349)',
        cmd: `grep -qiE "SideMenu|Menu lateral" docs/reference/features.md && [ ! -f src/components/layout/SideMenu.tsx ] && echo "docs/reference/features.md: describe SideMenu inexistente; la navegacion real es TabBar (BottomNavigation)" || true`,
      },
    ],
  },

  // ============================================================
  // 312 — Correctness
  // ============================================================
  {
    id: '312',
    name: 'correctness',
    docPath: 'docs/reference/guards/312-correctness.md',
    rules: [
      {
        id: 'R1-authcontext-loading-finally',
        desc: 'AuthContext: la carga de perfil en onAuthStateChanged debe resetear isLoading en un finally (evita loading infinito si el getDoc rechaza, #341)',
        cmd: `grep -q "} finally {" src/context/AuthContext.tsx || echo "src/context/AuthContext.tsx: setIsLoading(false) no esta en un finally — riesgo de loading infinito si fetchUserProfileDoc rechaza"`,
      },
      {
        id: 'R2-updateUserAvatar-no-fallback',
        desc: 'updateUserAvatar usa updateDoc sin fallback de creacion de doc (lanza not-found si el user doc no existe, #341)',
        cmd: `awk '/export async function updateUserAvatar/,/^}/' src/services/userProfile.ts | grep -q "merge: true\\|setDoc\\|getDoc" || echo "src/services/userProfile.ts: updateUserAvatar usa updateDoc sin fallback setDoc/merge (a diferencia de updateUserDisplayName)"`,
      },
    ],
  },
];

export const guardById = Object.fromEntries(guards.map((g) => [g.id, g]));
