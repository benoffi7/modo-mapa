# Specs: #285 BackupsPanel — Extract Service Layer

**Issue:** #285
**Fecha:** 2026-03-31

---

## Contexto

`BackupsPanel.tsx` importa `httpsCallable` de `firebase/functions` directamente y declara
cuatro callables inline (líneas 10–53). Esto viola la convención de service layer establecida en
`#279` (adminFeatured, adminPhotos). La corrección mueve esas llamadas a
`src/services/admin/backups.ts` y actualiza el barrel `src/services/admin/index.ts`.

No hay cambio de Firestore, reglas, ni datos: es puramente una reorganización de imports.

---

## Tipos

Los tipos de request/response viven actualmente en `BackupsPanel.tsx`. Se mueven al nuevo archivo
de servicio. `BackupEntry` y `ConfirmAction` permanecen en
`src/components/admin/backupTypes.ts` porque son tipos de UI usados por `BackupTable` y
`BackupConfirmDialog`.

```ts
// src/services/admin/backups.ts — tipos internos del servicio

interface ListBackupsRequest {
  pageSize?: number;
  pageToken?: string;
}

export interface ListBackupsResponse {
  backups: BackupEntry[];
  nextPageToken: string | null;
  totalCount: number;
}

interface CreateBackupResponse {
  id: string;
  createdAt: string;
}

interface RestoreBackupRequest {
  backupId: string;
}

interface DeleteBackupRequest {
  backupId: string;
}

interface SuccessResponse {
  success: true;
}
```

`BackupEntry` se importa desde `../../components/admin/backupTypes` (o se duplica como tipo
mínimo en el servicio para evitar dependencia inversa — ver Decisiones técnicas).

---

## Firma del servicio

```ts
// src/services/admin/backups.ts

export async function listBackups(
  pageSize: number,
  pageToken?: string
): Promise<ListBackupsResponse>

export async function createBackup(): Promise<CreateBackupResponse>

export async function restoreBackup(backupId: string): Promise<void>

export async function deleteBackup(backupId: string): Promise<void>
```

Cada función crea su callable localmente (como `moderation.ts`) — no se crean a nivel de módulo
para evitar efectos de inicialización en tests.

---

## Componentes

### BackupsPanel.tsx (modificado)

- **Eliminar:** imports de `httpsCallable`, `HttpsCallableResult`, `functions` desde `firebase/functions` y `../../config/firebase`
- **Eliminar:** interfaces de request/response (líneas 20–46)
- **Eliminar:** constantes `createBackupFn`, `listBackupsFn`, `restoreBackupFn`, `deleteBackupFn` (líneas 50–53)
- **Agregar:** import de `{ listBackups, createBackup, restoreBackup, deleteBackup }` desde `../../services/admin/backups`
- **Actualizar:** usos en `fetchBackups`, `handleCreate`, `handleRestore`, `handleDelete` para llamar las funciones del servicio directamente (sin `.data` wrapper — el servicio devuelve los datos ya extraídos)

Tamaño estimado post-refactor: ~210 líneas (actualmente ~275, se eliminan ~65 líneas de definiciones inline).

---

## Servicios

### src/services/admin/backups.ts (nuevo)

| Función | CF name | Input | Output |
|---------|---------|-------|--------|
| `listBackups(pageSize, pageToken?)` | `listBackups` | `ListBackupsRequest` | `ListBackupsResponse` |
| `createBackup()` | `createBackup` | `{}` | `CreateBackupResponse` |
| `restoreBackup(backupId)` | `restoreBackup` | `RestoreBackupRequest` | `void` |
| `deleteBackup(backupId)` | `deleteBackup` | `DeleteBackupRequest` | `void` |

### src/services/admin/index.ts (modificado)

Agregar al barrel:
```ts
export { listBackups, createBackup, restoreBackup, deleteBackup } from './backups';
```

---

## Tests

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `src/services/admin/__tests__/backups.test.ts` | Cada función llama al callable correcto con los args correctos; `listBackups` retorna `response.data`; errores se propagan | Unit |

Patron de mock: igual que `moderation.test.ts` — `vi.mock('firebase/functions', ...)` con `mockCallable`.

---

## Decisiones tecnicas

**Dependencia inversa (servicio → componente):** `BackupEntry` esta definida en
`src/components/admin/backupTypes.ts`. Para evitar que un servicio importe de `components/`,
se define un tipo `BackupEntry` mínimo dentro del servicio (solo `id` y `createdAt`) o se mueve
`backupTypes.ts` a `src/types/admin.ts`. La opción más limpia es mover solo `BackupEntry`
a `src/types/admin.ts` y actualizar los imports en `backupTypes.ts` y el componente.
`ConfirmAction` permanece en `backupTypes.ts` porque es puramente UI.

Si mover `BackupEntry` a `src/types/admin.ts` resulta en conflicto de nombre con tipos
existentes, se define un alias local en el servicio (`BackupEntryData`) para desacoplar.

**Callables locales vs. módulo:** `moderation.ts` crea callables dentro de cada función
(no a nivel de módulo). Este patrón se replica en `backups.ts` para consistencia y para
evitar que los tests necesiten mock de inicialización de Firebase.

---

## Integracion

`BackupsPanel.tsx` es el único consumidor de los cuatro callables. No hay hooks intermedios.
El refactor es interno al componente: misma lógica, distinto origen de las funciones.

### Preventive checklist

- [x] **Service layer**: El componente actualmente importa `firebase/functions` directamente — este issue lo corrige
- [x] **Duplicated constants**: Los tipos de request/response se consolidan en el servicio
- [x] **Context-first data**: No aplica (llamadas a CF, no Firestore)
- [x] **Silent .catch**: No hay `.catch(() => {})` — todos los errores son re-thrown
- [x] **Stale props**: No aplica (BackupsPanel no recibe props de datos)
