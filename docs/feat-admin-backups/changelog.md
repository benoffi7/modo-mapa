# Changelog — Gestion de backups de Firestore

**Issue:** [#34](https://github.com/benoffi7/modo-mapa/issues/34)
**PR:** [#35](https://github.com/benoffi7/modo-mapa/pull/35)
**Fecha:** 2026-03-12

---

## Archivos creados

| Archivo | Descripcion |
|---------|-------------|
| `functions/src/admin/backups.ts` | 4 Cloud Functions callable: createBackup, listBackups, restoreBackup, deleteBackup |
| `functions/.env` | Variable `ADMIN_EMAIL` parametrizada con `defineString` |
| `src/components/admin/BackupsPanel.tsx` | UI de gestion de backups con tabla, paginacion, crear, restaurar, eliminar con confirmacion |
| `src/components/admin/AdminPanelWrapper.tsx` | Wrapper compartido loading/error/empty para paneles admin |
| `src/hooks/useAsyncData.ts` | Hook generico para fetch async con loading/error states |
| `src/services/index.ts` | Barrel export del service layer |
| `src/services/favorites.ts` | Service para coleccion favorites (addFavorite, removeFavorite) |
| `src/services/ratings.ts` | Service para coleccion ratings (upsertRating) |
| `src/services/comments.ts` | Service para coleccion comments (addComment, deleteComment) |
| `src/services/tags.ts` | Service para colecciones userTags y customTags (CRUD) |
| `src/services/feedback.ts` | Service para coleccion feedback (sendFeedback) |
| `src/services/admin.ts` | Service para queries admin (fetchCounters, fetchRecent*, fetchUsersPanelData, etc.) |
| `src/utils/formatDate.ts` | Utilidades compartidas de formato de fecha: toDate, formatDateShort, formatDateMedium, formatDateFull |
| `docs/CODING_STANDARDS.md` | Estandares de codigo: service layer, patrones, convenciones TS, SOLID |
| `docs/reports/security-audit-v1.4.md` | Auditoria de seguridad v1.4 |
| `docs/reports/architecture-audit-v1.4.md` | Auditoria de arquitectura v1.4 |
| `docs/feat-admin-backups/prd.md` | PRD del feature |
| `docs/feat-admin-backups/specs.md` | Especificacion tecnica |
| `docs/feat-admin-backups/plan.md` | Plan de implementacion |
| `docs/feat-admin-backups/changelog.md` | Este archivo |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `functions/src/index.ts` | Exportar createBackup, listBackups, restoreBackup, deleteBackup |
| `functions/package.json` | Agregar `@google-cloud/firestore` y `@google-cloud/storage` |
| `src/components/admin/AdminLayout.tsx` | Agregar tab "Backups" (index 7) con BackupsPanel |
| `src/config/firebase.ts` | Exportar instancia de Functions con emulator support; App Check obligatorio en prod |
| `src/context/AuthContext.tsx` | Separacion de user create/update en setDisplayName |
| `firebase.json` | Agregar `*.cloudfunctions.net` a CSP connect-src |
| `firestore.rules` | Validacion de timestamps, longitudes de campos, ownership en todas las colecciones |
| `.gitignore` | Agregar `functions/lib/`, `.claude/*` con excepciones |
| `docs/PROJECT_REFERENCE.md` | Documentar feature de backups, service layer, utilidades compartidas, Cloud Storage, IAM roles |

## Security hardening (v1.3.0 -> v1.4.0)

| Mejora | Detalle |
|--------|---------|
| Admin email parametrizado | `ADMIN_EMAIL` via `defineString` en `functions/.env` en lugar de hardcoded |
| Email verified | `verifyAdmin()` verifica `email_verified` ademas de comparar email |
| Rate limiting callable | 5 llamadas/minuto por usuario (in-memory por instancia) |
| Input validation | `validateBackupId` con regex `^[\w.-]+$` para prevenir path traversal |
| Logging seguro | `maskEmail()` enmascara emails en logs |
| Error mapping | Errores de permisos/not-found se mapean a `HttpsError` apropiados |
| App Check enforced | `enforceAppCheck: true` en las 4 funciones callable |
| Backup bucket dedicado | Bucket separado `modo-mapa-app-backups` en `southamerica-east1` |
| Pre-restore safety backup | Backup automatico antes de cada restore |

## Funcionalidad deleteBackup

| Aspecto | Detalle |
|---------|---------|
| Cloud Function | `deleteBackup` callable, timeout 120s, memory 256MiB |
| Logica | Lista archivos con prefijo `backups/{id}/`, elimina todos con `Promise.all` |
| UI | Boton eliminar por fila, dialog de confirmacion, actualizacion optimista del estado |

## Paginacion en BackupsPanel

| Aspecto | Detalle |
|---------|---------|
| Page size | 20 backups por pagina (configurable, max 100) |
| Mecanismo | `pageToken` basado en ID del ultimo backup de la pagina |
| UI | Boton "Cargar mas" al final de la tabla, contador total |

## Fixes durante deploy a produccion

| Problema | Causa | Fix |
|----------|-------|-----|
| CSP bloqueaba llamadas a Cloud Functions | `*.cloudfunctions.net` no estaba en `connect-src` | Agregar dominio a CSP en `firebase.json` |
| "The specified bucket does not exist" | Bucket name incorrecto (`*.firebasestorage.app` vs `*.appspot.com`) | Crear bucket dedicado `modo-mapa-app-backups` |
| CI/CD 403 en deploy Firestore rules | Service account sin permisos | Agregar roles `serviceUsageConsumer`, `firebase.admin` en IAM |

## IAM roles configurados

Service account `591435782056-compute@developer.gserviceaccount.com`:

- `roles/storage.admin` — listar/escribir/eliminar backups en GCS
- `roles/datastore.importExportAdmin` — export/import Firestore

## Service layer creado

Se creo la capa de servicios `src/services/` para abstraer Firestore de los componentes:

- Cada coleccion tiene su modulo de servicio con funciones `async` planas.
- Los componentes importan de `src/services/` en lugar de `firebase/firestore`.
- Invalidacion de caches integrada en cada operacion de escritura.
- `admin.ts` centraliza todas las queries read-only del dashboard admin.
- Barrel export en `index.ts` para imports limpios.
