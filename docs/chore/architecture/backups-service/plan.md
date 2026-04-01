# Plan: #285 BackupsPanel — Extract Service Layer

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-31

---

## Fases de implementacion

### Fase 1: Crear el servicio

**Branch:** `chore/285-backups-service`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/admin.ts` | Agregar `BackupEntry` (`id: string; createdAt: string`) si no existe ya; si hay conflicto de nombre, usar `BackupEntryData` |
| 2 | `src/services/admin/backups.ts` | Crear archivo nuevo con `listBackups`, `createBackup`, `restoreBackup`, `deleteBackup`. Cada función crea su callable localmente. Importar `BackupEntry` desde `../../types/admin` |
| 3 | `src/services/admin/index.ts` | Agregar re-export: `export { listBackups, createBackup, restoreBackup, deleteBackup } from './backups'` |

### Fase 2: Refactorizar el componente

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `src/components/admin/backupTypes.ts` | Importar `BackupEntry` desde `../../types/admin` en lugar de definirla localmente (o re-exportarla desde ahí). `ConfirmAction` permanece definida aquí |
| 5 | `src/components/admin/BackupsPanel.tsx` | Eliminar imports de `httpsCallable`, `HttpsCallableResult`, `functions`; eliminar interfaces inline (líneas 20–46); eliminar constantes callable (líneas 50–53); agregar import de `{ listBackups, createBackup, restoreBackup, deleteBackup }` desde `../../services/admin/backups`; actualizar `fetchBackups`, `handleCreate`, `handleRestore`, `handleDelete` para llamar a las funciones del servicio (que retornan datos directamente, sin `.data`) |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 6 | `src/services/admin/__tests__/backups.test.ts` | Crear test con mocks de `firebase/functions` y `../../config/firebase`. Testear: `listBackups` llama callable `listBackups` con pageSize y pageToken opcionales y retorna `response.data`; `createBackup` llama callable `createBackup` con `{}`; `restoreBackup` llama callable `restoreBackup` con `{ backupId }`; `deleteBackup` llama callable `deleteBackup` con `{ backupId }`; errores se propagan en cada función |

### Fase final: Documentacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 7 | `docs/reference/patterns.md` | Verificar que el patron de service layer para httpsCallable este documentado; agregar nota si faltaba |

---

## Orden de implementacion

1. `src/types/admin.ts` — agregar `BackupEntry` primero para que el servicio pueda importarla
2. `src/services/admin/backups.ts` — nuevo servicio depende del tipo
3. `src/services/admin/index.ts` — barrel depende del servicio
4. `src/components/admin/backupTypes.ts` — actualizar importacion de `BackupEntry`
5. `src/components/admin/BackupsPanel.tsx` — refactorizar imports y llamadas
6. `src/services/admin/__tests__/backups.test.ts` — tests del nuevo servicio

---

## Estimacion de tamaño de archivos resultantes

| Archivo | Lineas actuales | Lineas estimadas | Accion si >400 |
|---------|----------------|-----------------|----------------|
| `src/services/admin/backups.ts` | 0 (nuevo) | ~65 | No aplica |
| `src/services/admin/index.ts` | 55 | ~59 | No aplica |
| `src/components/admin/BackupsPanel.tsx` | 275 | ~210 | No aplica |
| `src/services/admin/__tests__/backups.test.ts` | 0 (nuevo) | ~80 | No aplica |

---

## Riesgos

1. **`BackupEntry` ya existe en `src/types/admin.ts` con campos distintos.** Verificar antes de escribir. Si hay conflicto de nombre, crear `BackupEntryData` en el servicio como tipo local y no mover al barrel de tipos.

2. **`fetchBackups` en `BackupsPanel` usa `.data` del resultado del callable.** El servicio extrae `.data` internamente, como hace `moderation.ts`. Al refactorizar el componente, asegurarse de eliminar el acceso `.data` para no romper la desestructuración de `{ backups, nextPageToken, totalCount }`.

3. **Tests de integración del componente.** Si existen tests que mockean los callables directamente en `BackupsPanel`, deberán actualizarse para mockear `../../services/admin/backups`. Verificar con `grep -r "createBackup\|listBackups" src --include="*.test.*"` antes de comenzar.

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/functions` directamente — este issue elimina la violacion
- [x] Archivos nuevos en carpeta de dominio correcta (`src/services/admin/`)
- [x] Logica de negocio en services, no en componentes
- [x] Ningun archivo resultante supera 400 lineas

## Guardrails de seguridad

- No aplica — no hay colecciones Firestore nuevas ni campos nuevos

## Guardrails de accesibilidad y UI

- No aplica — no hay cambios de UI

## Guardrails de copy

- No aplica — no hay textos nuevos

## Criterios de done

- [ ] `BackupsPanel.tsx` no importa `firebase/functions` ni `../../config/firebase`
- [ ] `src/services/admin/backups.ts` existe con las 4 funciones exportadas
- [ ] `src/services/admin/index.ts` re-exporta las 4 funciones
- [ ] Tests en `backups.test.ts` cubren las 4 funciones + propagacion de error
- [ ] `npm run lint` sin errores
- [ ] `npm run build` sin errores
- [ ] `npm test` pasa
