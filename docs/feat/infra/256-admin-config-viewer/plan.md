# Plan: Admin Config Collection Viewer/Editor

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-30

---

## Fases de implementacion

### Fase 1: Tipos, constantes y analytics events

**Branch:** `feat/256-admin-config-viewer`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Agregar interfaces `ConfigDocument`, `ModerationConfig`, `ActivityFeedDiagItem`, `ActivityFeedDiagResponse` |
| 2 | `src/constants/analyticsEvents/admin.ts` | Crear archivo con `ADMIN_CONFIG_VIEWED`, `ADMIN_MODERATION_UPDATED`, `ADMIN_ACTIVITY_FEED_DIAG` |
| 3 | `src/constants/analyticsEvents/index.ts` | Agregar `export * from './admin'` al barrel |
| 4 | `src/constants/messages/admin.ts` | Agregar mensajes: `moderationSaveSuccess`, `moderationSaveError`, `moderationConfirmTitle`, `moderationConfirmBody` |

### Fase 2: Cloud Functions (callables)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/utils/abuseLogger.ts` | Extender union type `AbuseLogEntry.type` con `'config_edit'` y agregar severity `'low'` al mapa |
| 2 | `functions/src/admin/moderationConfig.ts` | Crear callable `updateModerationConfig`: assertAdmin, validate bannedWords (array, strings, length), checkCallableRateLimit, read prev config, write with Admin SDK, log abuse entry |
| 3 | `functions/src/admin/activityFeedDiag.ts` | Crear callable `getActivityFeedDiag`: assertAdmin, validate userId/limit, query `activityFeed/{userId}/items` ordered by createdAt desc with limit, calculate isExpired, serialize timestamps |
| 4 | `functions/src/index.ts` | Agregar exports: `export { updateModerationConfig } from './admin/moderationConfig'` y `export { getActivityFeedDiag } from './admin/activityFeedDiag'` |

### Fase 3: Service layer (frontend)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/admin/config.ts` | Crear archivo con: `CONFIG_DOC_IDS` array constante, `fetchConfigDocs()` (getDoc para cada doc conocido), `fetchConfigDoc(docId)`, `updateModerationBannedWords(words)` via httpsCallable, `fetchActivityFeedDiag(userId)` via httpsCallable |
| 2 | `src/services/admin/index.ts` | Agregar exports de config.ts: `fetchConfigDocs`, `fetchConfigDoc`, `updateModerationBannedWords`, `fetchActivityFeedDiag` |

### Fase 4: Componentes UI

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/config/ConfigDocViewer.tsx` | Crear componente read-only para renderizar campos de un config doc en formato key-value. Arrays como lista, timestamps formateados, numeros con toLocaleString |
| 2 | `src/components/admin/config/ModerationEditor.tsx` | Crear editor de bannedWords: state local con copia del array, Chips con delete, TextField + boton para agregar, validacion client-side (vacia, duplicada, > 50 chars), Dialog de confirmacion, onSave callback, loading/toast |
| 3 | `src/components/admin/config/ActivityFeedDiag.tsx` | Crear diagnostico: TextField userId + boton Buscar, Table con resultados, Chips de color por tipo (rating=info, comment=success, favorite=secondary), Chip estado (Activo/Expirado), estados vacio/loading/error/sin resultados |
| 4 | `src/components/admin/ConfigPanel.tsx` | Crear panel principal: useAsyncData + AdminPanelWrapper, Accordions para cada config doc (usa ConfigDocViewer), seccion especial para moderation (ModerationEditor), seccion ActivityFeedDiag separada por Divider. trackEvent al montar |

### Fase 5: Integracion en AdminLayout

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/admin/AdminLayout.tsx` | Import ConfigPanel, agregar `<Tab label="Configuracion" />` como tab 16, agregar `{tab === 16 && <ConfigPanel />}` al render |

### Fase 6: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `functions/src/admin/__tests__/moderationConfig.test.ts` | Tests: assertAdmin reject, input validation (not array, string too long, array > 500), rate limit, successful update + audit log |
| 2 | `functions/src/admin/__tests__/activityFeedDiag.test.ts` | Tests: assertAdmin reject, missing userId, invalid limit, successful query with expired items, empty feed |
| 3 | `src/services/admin/__tests__/config.test.ts` | Tests: fetchConfigDocs (all docs, some missing), fetchConfigDoc (exists, not exists), updateModerationBannedWords (callable mock), fetchActivityFeedDiag (callable mock) |
| 4 | `src/components/admin/__tests__/ConfigPanel.test.tsx` | Tests: renders all accordions, loading state, error state |
| 5 | `src/components/admin/config/__tests__/ModerationEditor.test.tsx` | Tests: add word, remove word, validation, save with confirmation dialog, error handling |
| 6 | `src/components/admin/config/__tests__/ActivityFeedDiag.test.tsx` | Tests: search, results with types/expiry, empty state, loading state |

### Fase 7: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Agregar tab "Configuracion" en la seccion Admin del documento |
| 2 | `docs/reference/patterns.md` | Agregar entrada sobre el patron de config viewer/editor si es reutilizable |
| 3 | `docs/reference/tests.md` | Actualizar inventario con los 6 nuevos archivos de test |

---

## Orden de implementacion

1. `src/types/admin.ts` — interfaces nuevas (sin dependencias)
2. `src/constants/analyticsEvents/admin.ts` + barrel update — analytics events
3. `src/constants/messages/admin.ts` — mensajes de usuario
4. `functions/src/utils/abuseLogger.ts` — extender type union (dependencia de moderationConfig)
5. `functions/src/admin/moderationConfig.ts` — callable (depende de abuseLogger)
6. `functions/src/admin/activityFeedDiag.ts` — callable (sin deps internas nuevas)
7. `functions/src/index.ts` — exportar callables
8. `src/services/admin/config.ts` — service layer (depende de tipos)
9. `src/services/admin/index.ts` — barrel update
10. `src/components/admin/config/ConfigDocViewer.tsx` — componente base
11. `src/components/admin/config/ModerationEditor.tsx` — editor (depende de service)
12. `src/components/admin/config/ActivityFeedDiag.tsx` — diagnostico (depende de service)
13. `src/components/admin/ConfigPanel.tsx` — orquestador (depende de subcomponentes)
14. `src/components/admin/AdminLayout.tsx` — integracion final
15. Tests (todos los archivos de Fase 6)
16. Documentacion (Fase 7)

## Estimacion de tamano de archivos

| Archivo | Lineas estimadas | Excede 400? |
|---------|-----------------|-------------|
| `src/types/admin.ts` (modificado) | ~165 (136 + ~30 nuevas) | No |
| `src/services/admin/config.ts` | ~80 | No |
| `src/components/admin/ConfigPanel.tsx` | ~120 | No |
| `src/components/admin/config/ConfigDocViewer.tsx` | ~80 | No |
| `src/components/admin/config/ModerationEditor.tsx` | ~150 | No |
| `src/components/admin/config/ActivityFeedDiag.tsx` | ~160 | No |
| `functions/src/admin/moderationConfig.ts` | ~80 | No |
| `functions/src/admin/activityFeedDiag.ts` | ~70 | No |
| `src/components/admin/AdminLayout.tsx` (modificado) | ~92 (87 + 5) | No |

## Riesgos

1. **Config docs con estructura inesperada:** Algunos docs como `aggregates` o `analyticsCache` pueden tener estructuras complejas con arrays anidados. Mitigacion: el `ConfigDocViewer` maneja recursivamente objetos y arrays, con fallback a `JSON.stringify` para tipos no reconocidos.

2. **Rate limit diario vs PRD que dice 5/min:** El PRD menciona rate limit de 5/min pero `checkCallableRateLimit` opera con ventana diaria. Mitigacion: se usa 5/dia, que es mas restrictivo y consistente con la infraestructura existente. Para un admin editando banned words, 5 cambios al dia es mas que suficiente.

3. **Callable cold start en diagnostico:** `getActivityFeedDiag` puede tardar si la Cloud Function esta fria. Mitigacion: la UI muestra loading state. No hay timeout visible — el callable tiene el default de 60s.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente — usa service layer
- [x] Archivos nuevos en `src/components/admin/config/` (subdirectorio de dominio, sigue patron `admin/perf/`)
- [x] Logica de negocio en `src/services/admin/config.ts`, no en componentes
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan — no aplica
- [x] Ningun archivo resultante supera 400 lineas

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Agregar tab "Configuracion" en seccion Admin |
| 2 | `docs/reference/patterns.md` | Agregar patron de config viewer/editor en seccion "Admin panel decomposition" |
| 3 | `docs/reference/tests.md` | Agregar 6 nuevos archivos de test al inventario |

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Seed data updated (if schema changed) — N/A, no schema changes
- [ ] Privacy policy reviewed (if new data collection) — N/A, no new user data
- [ ] Reference docs updated (features.md, patterns.md, tests.md)
