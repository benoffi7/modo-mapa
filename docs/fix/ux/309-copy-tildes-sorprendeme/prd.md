# PRD: Tech debt copy — tildes faltantes + terminologia Sorprendeme inconsistente

**Feature:** 309-copy-tildes-sorprendeme
**Categoria:** fix / ux
**Fecha:** 2026-04-18
**Issue:** #309
**Prioridad:** Baja (tech-debt / UX pulish)

---

## Contexto

El agente `copy-auditor` corrio sobre `new-home` el 2026-04-18 y detecto 11 errores de ortografia (tildes faltantes) en textos user-facing y admin, inconsistencia de terminologia para la accion "Sorprendeme" (3 variantes distintas en el codigo), y 12+ strings hardcodeados repetidos que deberian estar en `src/constants/messages/common.ts`. El proyecto ya tiene infraestructura de textos centralizados (patron descrito en `patterns.md` > Copywriting) y policy de voseo rioplatense consistente; este tech-debt cierra gaps puntuales.

## Problema

- 11 strings user-facing con tildes faltantes en paneles admin y profile (`leidas`, `Leidas`, `Auditorias`, `Distribucion`, `rapidas`, `Seccion`, `Mas`), contradiciendo la policy de espanol argentino descrita en `patterns.md`.
- 3 variantes de la misma palabra ("Sorpresa" en `QuickActions`, "Sorpréndeme" en `HelpSection`, "Sorprendeme!" en admin GA4 defs). El terminal "Sorpresa" ni siquiera comparte raiz con el feature oficial ("Sorpréndeme" documentado en `features.md`).
- 12+ strings hardcodeados repetidos (`"Cerrar"`, `"Cerrar aviso"`, `"Cargar más"`, `"Cargando..."`, `"Buscar..."`, `"Algo salió mal"`, `"Ocurrió un error inesperado..."`) que deberian venir de `MSG_COMMON` — viola el patron "Textos centralizados en `src/constants/messages/`".
- Mensajes de error genericos no accionables (`MSG_COMMON.settingUpdateError = 'No se pudo guardar el cambio'`, `MSG_CHECKIN.error = 'Error al hacer check-in'`).

## Solucion

### S1 — Fix de tildes (11 strings)

Aplicar reemplazos directos en los 5 archivos afectados. Todos son strings JSX que no requieren logica adicional.

| File | Linea | Fix |
|------|-------|-----|
| `NotificationsSection.tsx` | 49 | `leidas` → `leídas` |
| `admin/NotificationsPanel.tsx` | 38,41,55,56,66 | `Leidas` → `Leídas`, `No leidas` → `No leídas` (5 usos en labels y headers) |
| `admin/SocialPanel.tsx` | 61,86 | `Reco. leidas` → `Reco. leídas`, `Mas seguidos` → `Más seguidos` |
| `admin/CronHealthSection.tsx` | 93 | `Distribucion` → `Distribución` |
| `admin/AdminLayout.tsx` | 69 | `Auditorias` → `Auditorías` |
| `admin/features/ga4FeatureDefinitions.ts` | 117,126,135,190 | `Acciones rapidas` → `Acciones rápidas`, `Seccion intereses` → `Sección intereses`, `Seccion digest` → `Sección digest`, `Sorprendeme!` → `Sorprendeme` (ver S2) |

Nota adicional detectada durante lectura: en `admin/NotificationsPanel.tsx` hay dos headers adicionales con `Leidas`/`No leidas` (lineas 55,56) que tambien hay que corregir.

### S2 — Unificar terminologia "Sorprendeme"

Decision de copy: usar **"Sorprendeme"** (voseo, sin exclamacion, sin tilde en "e" final del imperativo argentino). Alineado con `features.md` > Menu lateral donde la feature se describe como "Sorpréndeme" pero ajustado para coherencia con el voseo (imperativo vos = "sorprendeme" sin tilde, como "dejame", "contame").

Cambios:

| File | Linea | Antes | Despues |
|------|-------|-------|---------|
| `home/QuickActions.tsx` | 50 | `label: 'Sorpresa'` | `label: 'Sorprendeme'` |
| `profile/HelpSection.tsx` | 50 | `probar "Sorpréndeme"` | `probar "Sorprendeme"` |
| `admin/features/ga4FeatureDefinitions.ts` | 190 | `name: 'Sorprendeme!'` | `name: 'Sorprendeme'` |

Despues del fix actualizar `docs/reference/features.md` y `HelpSection` para documentar la forma canonica.

### S3 — Centralizar strings hardcodeados repetidos en `MSG_COMMON`

Extender `src/constants/messages/common.ts` con las claves que se repiten >=2 veces en el codigo, e importar desde los componentes consumidores. No centralizar strings que aparecen una sola vez (YAGNI).

Agregados a `MSG_COMMON`:

```ts
// aria-labels y acciones comunes
closeAriaLabel: 'Cerrar',
closeNoticeAriaLabel: 'Cerrar aviso',
loadMore: 'Cargar más',
loading: 'Cargando...',
searchPlaceholder: 'Buscar...',
// Error boundary
genericErrorTitle: 'Algo salió mal',
genericErrorBody: 'Ocurrió un error inesperado. Intentá recargar la página.',
```

Consumidores a actualizar (minimo 2 usos por clave para justificar extraccion):

- `closeAriaLabel` → 5 usos (UserProfileModal, AvatarPicker, MenuPhotoViewer, RatingPromptBanner, SpecialsSection, ToastContext)
- `closeNoticeAriaLabel` → 3 usos (SearchScreen, AccountBanner, StaleBanner)
- `loadMore` → 4 usos (PaginatedListShell, FavoritesList, BackupsPanel, AbuseAlerts, RatingsList, DeletionAuditPanel)
- `loading` → multiples (PaginatedListShell, FavoritesList, BackupsPanel, DeletionAuditPanel, RatingsList, TrendingList, LocalityPicker, CommentsList)
- `searchPlaceholder` → 1 uso (ListFilters) — NO extraer por YAGNI. Los otros placeholders de busqueda son dominio-especificos ("Buscar comercios...", "Buscar usuarios...", "Buscar ciudad o barrio...").
- `genericErrorTitle` + `genericErrorBody` → 1 uso (ErrorBoundary) pero aparecen duplicados en `ErrorBoundary.test.tsx` hardcodeados → centralizar y usar `MSG_COMMON` en el test tambien.

### S4 — Mensajes de error accionables

| Clave | Antes | Despues |
|-------|-------|---------|
| `MSG_COMMON.settingUpdateError` | `'No se pudo guardar el cambio'` | `'No pudimos guardar el cambio. Intentá de nuevo.'` |
| `MSG_CHECKIN.error` | `'Error al hacer check-in'` | `'No se pudo registrar la visita. Intentá de nuevo.'` |

Alineado con el tono del proyecto (toast `MSG_OFFLINE.syncFailed`, errores de auth en `constants/auth.ts`).

### UX considerations

- Ningun cambio de layout ni nuevos componentes.
- Los cambios en aria-labels son semanticamente identicos (mejora tests accesibilidad que busquen por texto).
- Sin impacto en analytics (los eventos siguen con los mismos nombres; solo cambia `name` de `GA4FeatureDef` que es label visual del admin panel).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1 — Fix tildes (5 archivos, 11 strings) | Alta | XS |
| S2 — Unificar Sorprendeme (3 archivos) | Alta | XS |
| S3 — Centralizar 4 claves en `MSG_COMMON` + reemplazar 12+ call sites | Media | S |
| S4 — Hacer `settingUpdateError` y `MSG_CHECKIN.error` accionables | Media | XS |
| Update `ErrorBoundary.test.tsx` para consumir `MSG_COMMON` | Media | XS |
| Update `docs/reference/features.md` (Sorprendeme canonico) | Baja | XS |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Fix de tildes en comentarios de codigo o nombres de variables (solo strings user-facing).
- Reescritura de los mensajes de auth en `constants/auth.ts` (ya son accionables, fuera del alcance del audit).
- Centralizar placeholders de busqueda dominio-especificos ("Buscar comercios...", "Buscar usuarios...") — son texto de dominio, no boilerplate.
- Cambios en el espanol argentino ya correcto (voseo ya consistente segun audit).
- Revisar tildes en docs `.md` (fuera de user-facing code).
- Cambio de nombre de la feature "Sorprendeme" a otra palabra (solo unificar variantes existentes).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/components/layout/ErrorBoundary.test.tsx` | Component | Ajustar assertions para consumir `MSG_COMMON.genericErrorTitle`/`Body` (cambio mecanico tras S3) |
| `src/components/ui/OfflineIndicator.test.tsx` | Component | Sin cambios esperados (ya usa MSG_OFFLINE) |
| `src/components/onboarding/AccountBanner.test.tsx` | Component | Ajustar si el test busca por texto `'Cerrar aviso'` (ahora viene de MSG_COMMON) |
| `src/components/onboarding/VerificationNudge.test.tsx` | Component | Sin cambios (aria-label custom "Cerrar nudge de verificación") |
| `src/components/ui/RatingPromptBanner.test.tsx` | Component | Ajustar si el test busca por texto `'Cerrar'` (ahora viene de MSG_COMMON) |

No se esperan tests unitarios nuevos — es un cambio de copy y centralizacion. Los tests existentes que dependen del texto se ajustan para consumir los mismos mensajes desde `MSG_COMMON` (single source of truth).

### Criterios de testing

- Cobertura >= 80% del codigo nuevo (los cambios son triviales, cobertura existente se mantiene)
- Todos los tests existentes siguen pasando tras los cambios de copy
- Lint y typecheck verdes
- El agente `copy-auditor` re-ejecutado sobre `new-home` reporta 0 errores de tildes en los archivos afectados

---

## Seguridad

Feature sin impacto de seguridad. No se agregan colecciones, campos, endpoints, Cloud Functions, escrituras a Firestore ni inputs de usuario nuevos.

- [x] Sin nuevos vectores de ataque
- [x] Sin cambios en Firestore rules
- [x] Sin cambios en Cloud Functions
- [x] Sin exposicion de datos nuevos
- [x] Sin modificacion de authz logic

### Vectores de ataque automatizado

N/A — solo cambios de string literales.

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #270 Copy Audit (tildes, voseo, anonimo) | Mismo dominio — cerrado | Confirmar que este issue no reintroduce errores detectados en #270 |
| #282 Copy Fixes v2 | Mismo dominio — cerrado | Extender la misma linea de trabajo con los items detectados en #309 |
| #292-#294 Copy + Dark Mode + Code Quality | Mismo dominio — cerrado | Este issue completa el #292 de la serie (tercer round de audit) |

### Mitigacion incorporada

- Centralizar las 4 claves repetidas en `MSG_COMMON` reduce la probabilidad de que vuelvan a aparecer tildes faltantes en el futuro (single source of truth).
- Actualizar `ErrorBoundary.test.tsx` para consumir `MSG_COMMON` elimina el duplicado que estaba desconectado del componente real.

---

## Robustez del codigo

### Checklist de hooks async

- [x] N/A — no se agregan hooks ni operaciones async
- [x] `logger.error` no modificado
- [x] Archivos nuevos N/A
- [x] localStorage N/A

### Checklist de observabilidad

- [x] N/A — no hay Cloud Functions nuevas
- [x] N/A — no hay services nuevos
- [x] N/A — no hay trackEvent nuevos

### Checklist offline

- [x] N/A — no hay formularios nuevos
- [x] `MSG_CHECKIN.error` nuevo texto mantiene semantica (sigue mostrandose en catch)

### Checklist de documentacion

- [x] No se agregan secciones de HomeScreen
- [x] No hay analytics events nuevos
- [x] No hay tipos nuevos
- [ ] `docs/reference/features.md` actualizado: "Sorpréndeme" → "Sorprendeme" para unificar con el codigo
- [x] No hay colecciones Firestore nuevas
- [x] No hay patrones nuevos

---

## Offline

### Data flows

N/A — no hay lecturas/escrituras nuevas.

### Checklist offline

- [x] N/A — solo cambios de strings
- [x] `MSG_CHECKIN.error` nuevo texto sigue siendo mostrado via toast en catch existente
- [x] `MSG_COMMON.settingUpdateError` consumido por `userSettings` optimistic UI (revert on error) — ya es offline-safe por el patron existente

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] No se agrega logica de negocio
- [x] No se agregan componentes
- [x] No se agrega estado global
- [x] N/A — no hay props nuevas
- [x] N/A — no hay handlers nuevos
- [x] N/A — no hay imports de Firebase nuevos
- [x] N/A — no se crean hooks
- [x] N/A — no se agregan converters
- [x] N/A — ningun archivo nuevo
- [x] Los archivos modificados siguen debajo de 400 lineas (max afectado: HelpSection 242, QuickActions 213)

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Centralizar strings en `MSG_COMMON` reduce duplicacion |
| Estado global | = | Sin cambios |
| Firebase coupling | = | Sin cambios |
| Organizacion por dominio | = | Sin cambios — solo edits in-place |

---

## Accesibilidad y UI mobile

### Checklist de accesibilidad

- [x] Los aria-labels refactorizados mantienen texto descriptivo identico
- [x] Semantica HTML no cambia
- [x] N/A — no hay clickable `<Box>`
- [x] Touch targets no modificados
- [x] Error states no modificados
- [x] Imagenes no modificadas
- [x] Formularios no modificados

### Checklist de copy

- [x] Todos los textos en espanol con tildes correctas (objetivo principal del feature)
- [x] Tono consistente: voseo (ya correcto en todo el codigo)
- [x] Terminologia unificada: "Sorprendeme" (S2)
- [x] Strings reutilizables centralizados en `MSG_COMMON` (S3)
- [x] Mensajes de error accionables (S4)

---

## Success Criteria

1. Los 11 strings con tildes reportados en el issue #309 estan corregidos y visibles en produccion.
2. El nombre de la feature "Sorprendeme" aparece unificado en los 3 archivos (`QuickActions`, `HelpSection`, `ga4FeatureDefinitions`).
3. Las 4 claves nuevas en `MSG_COMMON` (`closeAriaLabel`, `closeNoticeAriaLabel`, `loadMore`, `loading`, `genericErrorTitle`, `genericErrorBody`) son consumidas desde minimo 2 call sites cada una.
4. El agente `copy-auditor` re-ejecutado sobre `new-home` reporta 0 errores de tildes en los 5 archivos afectados.
5. Todos los tests existentes pasan (incluido `ErrorBoundary.test.tsx` actualizado).
