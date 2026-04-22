# Specs: #309 Tech debt copy — tildes faltantes + terminologia Sorprendeme

**Feature:** 309-copy-tildes-sorprendeme
**PRD:** [prd.md](./prd.md)
**Fecha:** 2026-04-18

---

## Objetivo tecnico

Aplicar cambios mecanicos de copy sobre 5 archivos, unificar la terminologia "Sorprendeme" en 3 archivos, y centralizar 6 claves repetidas en `MSG_COMMON` consumidas desde minimo 10 call sites. Sin logica nueva, sin tipos nuevos, sin tests unitarios nuevos (solo ajustes a tests existentes que hardcodean strings).

---

## Archivos a tocar

### Modificados (edit in-place)

| Archivo | Cambio | Lineas |
|---------|--------|--------|
| `src/constants/messages/common.ts` | Agregar 6 claves nuevas + mejorar `settingUpdateError` | +8 / ~1 |
| `src/constants/messages/checkin.ts` | Mejorar texto de `error` | ~1 |
| `src/components/profile/NotificationsSection.tsx` | `leidas` → `leídas` | ~1 |
| `src/components/admin/NotificationsPanel.tsx` | `Leidas`/`No leidas` → `Leídas`/`No leídas` (5 usos) | ~5 |
| `src/components/admin/SocialPanel.tsx` | `Reco. leidas` → `Reco. leídas`, `Mas seguidos` → `Más seguidos` | ~2 |
| `src/components/admin/CronHealthSection.tsx` | `Distribucion` → `Distribución` | ~1 |
| `src/components/admin/AdminLayout.tsx` | `Auditorias` → `Auditorías` | ~1 |
| `src/components/admin/features/ga4FeatureDefinitions.ts` | 4 tildes + `Sorprendeme!` → `Sorprendeme` | ~4 |
| `src/components/home/QuickActions.tsx` | `Sorpresa` → `Sorprendeme` | ~1 |
| `src/components/profile/HelpSection.tsx` | `Sorpréndeme` → `Sorprendeme` | ~1 |
| `src/components/business/MenuPhotoViewer.tsx` | aria-label `"Cerrar"` → `MSG_COMMON.closeAriaLabel` | ~1 + import |
| `src/components/ui/RatingPromptBanner.tsx` | aria-label `"Cerrar"` → `MSG_COMMON.closeAriaLabel` | ~1 + import |
| `src/components/home/SpecialsSection.tsx` | aria-label `"Cerrar"` → `MSG_COMMON.closeAriaLabel` | ~1 + import |
| `src/components/profile/AvatarPicker.tsx` | aria-label `"Cerrar"` → `MSG_COMMON.closeAriaLabel` | ~1 + import |
| `src/components/social/UserProfileModal.tsx` | aria-label `"Cerrar"` → `MSG_COMMON.closeAriaLabel` | ~1 + import |
| `src/context/ToastContext.tsx` | aria-label `"Cerrar"` → `MSG_COMMON.closeAriaLabel` | ~1 + import |
| `src/components/onboarding/AccountBanner.tsx` | aria-label `"Cerrar aviso"` → `MSG_COMMON.closeNoticeAriaLabel` | ~1 + import |
| `src/components/ui/StaleBanner.tsx` | aria-label `"Cerrar aviso"` → `MSG_COMMON.closeNoticeAriaLabel` | ~1 + import |
| `src/components/search/SearchScreen.tsx` | aria-label `"Cerrar aviso"` → `MSG_COMMON.closeNoticeAriaLabel` | ~1 + import |
| `src/components/common/PaginatedListShell.tsx` | `"Cargar más"` / `"Cargando..."` → `MSG_COMMON.loadMore`/`loading` | ~2 + import |
| `src/components/lists/FavoritesList.tsx` | `"Cargando..."`, `"Cargar más"` → `MSG_COMMON` | ~2 + import |
| `src/components/admin/BackupsPanel.tsx` | `"Cargando..."`, `"Cargar más"` → `MSG_COMMON` | ~2 + import |
| `src/components/admin/AbuseAlerts.tsx` | `Cargar más (${N}…)` → `${MSG_COMMON.loadMore} (${N}…)` | ~1 + import |
| `src/components/admin/audit/DeletionAuditPanel.tsx` | `"Cargando..."`, `"Cargar más"` → `MSG_COMMON` | ~2 + import |
| `src/components/profile/RatingsList.tsx` | `"Cargando..."`, `"Cargar más"` → `MSG_COMMON` | ~2 + import |
| `src/components/layout/ErrorBoundary.tsx` | `"Algo salió mal"` y body → `MSG_COMMON.genericErrorTitle`/`Body` | ~2 + import |
| `src/components/layout/ErrorBoundary.test.tsx` | Ajustar assertions al nuevo origen de los strings | ~3 |
| `docs/reference/features.md` | "Sorpréndeme" → "Sorprendeme" (unificar con codigo) | ~3 |

### NO tocar (scope explicito)

- `src/components/home/TrendingList.tsx:28` — usa `Cargando...` pero esta embebido en un render de skeleton especifico; YAGNI, dejar para otro round.
- `src/components/profile/CommentsList.tsx:188` — `'Cargando todos los comentarios...'` es texto contextual especifico, no el loading generico.
- `src/components/profile/LocalityPicker.tsx:126` — `'Cargando...'` es fallback de estado especifico del autocomplete.
- `src/components/common/ListFilters.tsx:51` — placeholder `'Buscar...'` NO se centraliza (usado solo 1 vez; otros placeholders son dominio-especificos).
- `src/components/onboarding/VerificationNudge.tsx:99` — aria-label `"Cerrar nudge de verificación"` es especifico, no generico.
- `src/components/onboarding/ActivityReminder.tsx:35` — aria-label `"Cerrar recordatorio"` es especifico.
- `src/components/profile/OnboardingChecklist.tsx:150` — aria-label `"Cerrar primeros pasos"` es especifico.
- `src/components/business/BusinessSheet.tsx:20` — aria-label `"Cerrar detalles"` es especifico.

### Creados

Ninguno.

### Eliminados

Ninguno.

---

## Cambios al modelo de datos

Ninguno.

## Cambios a Firestore rules

Ninguno.

## Cambios a Cloud Functions

Ninguno.

## Cambios a analytics

Ninguno (los `eventNames` de GA4 no se tocan; solo cambia el `name` visual del feature card en admin).

---

## Detalle de cambios

### 1. `src/constants/messages/common.ts`

```ts
export const MSG_COMMON = {
  noUsersFound: 'No se encontraron usuarios',
  publicProfileHint: 'Quizás el usuario no tenga el perfil público',
  deleteError: 'No se pudo eliminar el comentario',
  editError: 'No se pudo guardar la edición',
  discardWarning: 'Tenés texto sin enviar. Si cerrás, se va a perder.',
  markReadError: 'No se pudo marcar como leída',
  markAllReadError: 'No se pudo marcar todo como leído',
  settingUpdateError: 'No pudimos guardar el cambio. Intentá de nuevo.', // S4: mas accionable
  // Nuevos (S3)
  closeAriaLabel: 'Cerrar',
  closeNoticeAriaLabel: 'Cerrar aviso',
  loadMore: 'Cargar más',
  loading: 'Cargando...',
  genericErrorTitle: 'Algo salió mal',
  genericErrorBody: 'Ocurrió un error inesperado. Intentá recargar la página.',
} as const;
```

### 2. `src/constants/messages/checkin.ts`

```ts
export const MSG_CHECKIN = {
  success: 'Visita registrada',
  removed: 'Visita desmarcada',
  tooFar: 'Parece que no estás cerca de este comercio',
  emptyVisits: 'Todavía no registraste visitas',
  error: 'No se pudo registrar la visita. Intentá de nuevo.', // S4
} as const;
```

### 3. Tildes en admin panels y profile

Reemplazos literales directos (ver tabla en PRD > S1).

### 4. Sorprendeme

3 archivos, 3 strings de UI (ver tabla en PRD > S2).

### 5. Migracion de aria-labels y botones a `MSG_COMMON`

Patron aplicado en cada call site:

```tsx
// Antes
<IconButton aria-label="Cerrar" onClick={onClose}>

// Despues
import { MSG_COMMON } from '../../constants/messages';
<IconButton aria-label={MSG_COMMON.closeAriaLabel} onClick={onClose}>
```

Para botones `Cargar más` / `Cargando...`:

```tsx
// Antes
<Button aria-label="Cargar más">
  {isLoadingMore ? 'Cargando...' : 'Cargar más'}
</Button>

// Despues
<Button aria-label={MSG_COMMON.loadMore}>
  {isLoadingMore ? MSG_COMMON.loading : MSG_COMMON.loadMore}
</Button>
```

### 6. `ErrorBoundary.tsx` y su test

```tsx
// ErrorBoundary.tsx
import { MSG_COMMON } from '../../constants/messages';
// ...
<Typography variant="h6">{MSG_COMMON.genericErrorTitle}</Typography>
<Typography variant="body2" color="text.secondary">
  {MSG_COMMON.genericErrorBody}
</Typography>
```

```ts
// ErrorBoundary.test.tsx (3 assertions a ajustar)
import { MSG_COMMON } from '../../constants/messages';
expect(screen.getByText(MSG_COMMON.genericErrorTitle)).toBeInTheDocument();
expect(screen.getByText(MSG_COMMON.genericErrorBody)).toBeInTheDocument();
```

### 7. `docs/reference/features.md`

Cambiar las 2 menciones de "sorpréndeme" / "Sorpréndeme" a "Sorprendeme" para reflejar el nombre canonico usado en el codigo (linea 65, 133 aprox).

---

## Tipos nuevos

Ninguno.

## Hooks nuevos

Ninguno.

## Services nuevos

Ninguno.

## Analytics events nuevos

Ninguno.

## Migraciones necesarias

Ninguna.

---

## Riesgos

| Riesgo | Mitigacion |
|--------|-----------|
| Tests existentes dependen del texto hardcodeado y rompen | Auditar tests con `grep 'Algo salió mal|Cerrar aviso|Cargar más|Ocurrió un error'` antes de commitear. Ajustar assertions a `MSG_COMMON.*`. |
| `MSG_COMMON` crece con strings poco relacionados | Limite: solo claves con >=2 call sites. `searchPlaceholder` NO se agrega. |
| Cambio de "Sorpresa" a "Sorprendeme" altera analytics historico | Analytics event `surprise_me` no cambia. Solo cambia el `name` visual del feature card en admin. |
| Cambio en `aria-label` rompe tests e2e que seleccionan por texto | Los aria-labels son equivalentes semanticamente. Tests de a11y que usan `getByRole('button', { name: 'Cerrar' })` siguen funcionando (texto identico, solo que viene de constante). |

---

## Tests

### Policy

- No agregar tests unitarios nuevos (el cambio es de copy, cubierto por los tests de componentes existentes).
- Ajustar tests que hardcodean los strings centralizados para consumir `MSG_COMMON`:
  - `ErrorBoundary.test.tsx` (3 usos)
  - `OfflineIndicator.test.tsx` (ya usa MSG_OFFLINE — sin cambios)
  - `AccountBanner.test.tsx` (1 uso — ajustar si busca `'Cerrar aviso'` por texto)
  - `VerificationNudge.test.tsx` (usa label especifico — sin cambios)
  - `RatingPromptBanner.test.tsx` (1 uso — ajustar si busca `'Cerrar'` por texto)
- Re-ejecutar el agente `copy-auditor` localmente sobre los 5 archivos afectados y confirmar 0 issues de tildes.

### Criterio de aceptacion

- `npm run lint` y `npm run typecheck` verdes.
- `npm run test:run` verde (incluyendo tests ajustados).
- Cobertura >= 80% (sin cambios esperados, los archivos modificados no introducen nueva logica).
- Build de produccion (`npm run build`) sin warnings nuevos.

---

## Rollout

- Single PR con commit atomico por seccion (S1 tildes, S2 sorprendeme, S3 centralize strings, S4 accionables).
- Bump de version opcional (patch `2.35.8`) — este tipo de fixes no suelen bumpear.
- Sin feature flag, sin migracion de datos.

---

## Referencias

- PRD: [prd.md](./prd.md)
- Audit original: `/health-check` copy-auditor agent 2026-04-18 (issue #309 body)
- Patrones copywriting: `docs/reference/patterns.md` > seccion "Copywriting y localizacion"
- Precedentes: #270 (copy-audit), #282 (copy-v2), #292 (copy-darkmode-quality)
