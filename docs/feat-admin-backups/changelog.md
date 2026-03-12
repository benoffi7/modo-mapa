# Changelog — Gestión de backups de Firestore

**Issue:** [#34](https://github.com/benoffi7/modo-mapa/issues/34)
**PR:** [#35](https://github.com/benoffi7/modo-mapa/pull/35)
**Fecha:** 2026-03-12

---

## Archivos creados

| Archivo | Descripción |
|---------|-------------|
| `functions/src/admin/backups.ts` | 3 Cloud Functions callable: createBackup, listBackups, restoreBackup |
| `src/components/admin/BackupsPanel.tsx` | UI de gestión de backups con tabla, crear, restaurar con confirmación |
| `docs/feat-admin-backups/prd.md` | PRD del feature |
| `docs/feat-admin-backups/specs.md` | Especificación técnica |
| `docs/feat-admin-backups/plan.md` | Plan de implementación |
| `docs/feat-admin-backups/changelog.md` | Este archivo |

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `functions/src/index.ts` | Exportar createBackup, listBackups, restoreBackup |
| `functions/package.json` | Agregar `@google-cloud/firestore` y `@google-cloud/storage` |
| `src/components/admin/AdminLayout.tsx` | Agregar tab "Backups" (index 7) con BackupsPanel |
| `src/config/firebase.ts` | Exportar instancia de Functions con emulator support |
| `firebase.json` | Agregar `*.cloudfunctions.net` a CSP connect-src |
| `.gitignore` | Agregar `functions/lib/` |
| `docs/PROJECT_REFERENCE.md` | Documentar feature de backups, Cloud Functions, IAM roles |

## Fixes durante deploy a producción

| Problema | Causa | Fix |
|----------|-------|-----|
| CSP bloqueaba llamadas a Cloud Functions | `*.cloudfunctions.net` no estaba en `connect-src` | Agregar dominio a CSP en `firebase.json` |
| "The specified bucket does not exist" | Bucket name incorrecto (`*.firebasestorage.app` vs `*.appspot.com`) | Cambiar `BUCKET_NAME` a `modo-mapa-app.appspot.com` |
| CI/CD 403 en deploy Firestore rules | Service account sin permisos | Agregar roles `serviceUsageConsumer`, `firebase.admin` en IAM |

## IAM roles configurados

Service account `591435782056-compute@developer.gserviceaccount.com`:

- `roles/storage.admin` — listar/escribir backups en GCS
- `roles/datastore.importExportAdmin` — export/import Firestore
