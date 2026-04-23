# Changelog

Todos los cambios notables del proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.39.0] — 2026-04-22

### Added

- `withBusyFlag(kind, fn)` utility: wraps user-explicit submits (rating, comment, check-in, form saves, photo upload) to block PWA reload during critical operations; ref-counted, heartbeat-aware, AbortSignal-safe
- `fetchAppVersionConfig`: server-first Firestore read with 2-retry exponential backoff (500ms/1500ms) for transient errors, then local cache fallback; returns `source` tag (`server | server-retry | cache | empty`)
- `useForceUpdate` now emits `EVT_APP_VERSION_ACTIVE` analytics event once per session with version gap details
- `useForceUpdate` now polls on `visibilitychange` and `online` events (in addition to interval)
- `registerPwa.ts`: explicit PWA registration with `registerType: 'prompt'`, checks busy-flag and cooldown before triggering SW reload
- `update-min-version.js` script: CI-injectable functions for setting `minVersion` in Firestore
- Storage keys: `STORAGE_KEY_FORCE_UPDATE_LAST_CHECK`, `STORAGE_KEY_FORCE_UPDATE_BUSY`, `STORAGE_KEY_APP_VERSION_EVENT_EMITTED`
- Timing constants: `FORCE_UPDATE_CHECK_INTERVAL_MS`, `FORCE_UPDATE_FETCH_RETRY_DELAYS_MS`, `BUSY_FLAG_MAX_AGE_MS`, `BUSY_FLAG_HEARTBEAT_MS`, `PWA_FALLBACK_GRACE_MS`
- Analytics: `EVT_APP_VERSION_ACTIVE` added to `system.ts` barrel and GA4 report
- Docs: rollback procedure (`docs/procedures/rollback.md`), patterns, Firestore schema, security notes updated
- Tests: 15 new test files, 1399 total passing; branches 80.25%, functions 79.41%

### Changed

- `vite.config.ts`: `registerType` changed from `'autoUpdate'` to `'prompt'` (explicit control over SW reload timing)
- `useForceUpdate`: `checkVersion()` now returns `{ status, minVersion, source }` for richer telemetry

## [Unreleased]

### Added

- Agente `copy-auditor` para auditoria de ortografia y tildes en archivos `.ts`/`.tsx`
- Audit de field whitelist en Firestore rules (merge Phase 1i)
- Audit de mutable props en template de specs
- SpecialsSection cards navegan a secciones correspondientes (trending a recientes, featured_list a listas)
- Firestore rules para colecciones `specials` y `achievements`
- Avatar selection persiste a Firestore (`users/{uid}.avatarId`)
- CollaborativeTab back handler para Android (hardware back button)
- ListCardGrid: layout responsive con `auto-fill`, cards cuadradas con `aspect-ratio: 1`, contenido centrado
- Chip "Destacada" en listas sigue design system (`borderRadius: 1`)
- ListDetailScreen: optimistic updates al volver atras (color, isPublic, itemCount)
- ListDetailScreen: dialog de confirmacion para eliminar lista
- ListDetailScreen: toggle publico/privado con rollback on error
- Business items en listas usan `cardSx` unificado

### Fixed

- Firestore rules faltantes para colecciones `specials` y `achievements`
- `removeBusinessFromList` usaba `businessId` en vez de `listItem.id` (corrupcion de datos)
- Cambio de color en listas rechazado por Firestore rules (faltaban `color` e `icon` en whitelist `hasOnly`)
- Lista no aparecia despues de crearla (insert optimistico faltante)
- Cambios no reflejados al volver desde detalle de lista (optimistic updates faltantes)
- Icono de candado no se actualizaba al togglear publico/privado (prop stale)
- SpecialsSection cards no hacian nada al clickear (callbacks no-op)
- Faltaba signo de apertura `?` en dialogos de confirmacion
- Errores de ortografia: "vacia" corregido a "vacía", "publica" corregido a "pública"

### Changed

- Business items en listas usan `cardSx` unificado en vez de estilos inline
- ListCardGrid usa columnas responsive con `auto-fill` y cards cuadradas centradas
- Avatar selection ahora persiste a Firestore en vez de solo localStorage
