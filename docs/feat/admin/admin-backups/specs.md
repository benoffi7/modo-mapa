# Especificación Técnica — Gestión de backups de Firestore

**Issue:** [#34](https://github.com/benoffi7/modo-mapa/issues/34)
**Fecha:** 2026-03-11

---

## Resumen

Se agregan 3 Cloud Functions callable (`createBackup`, `listBackups`, `restoreBackup`) y un componente `BackupsPanel` en el admin dashboard para gestionar backups de Firestore via export/import a Cloud Storage.

---

## Cloud Functions

### Dependencia

```bash
# En functions/
npm install @google-cloud/firestore
```

Se usa `FirestoreAdminClient` de `@google-cloud/firestore/v1` para las operaciones de export/import (la API de Admin SDK estándar no expone estas operaciones).

### createBackup

```typescript
// functions/src/admin/backups.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FirestoreAdminClient } from '@google-cloud/firestore/v1';

export const createBackup = onCall({
  timeoutSeconds: 300,
  memory: '256MiB',
}, async (request) => {
  // 1. Verificar que el caller es admin
  if (request.auth?.token.email !== 'benoffi11@gmail.com') {
    throw new HttpsError('permission-denied', 'Solo admin puede crear backups');
  }

  // 2. Ejecutar export
  const client = new FirestoreAdminClient();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bucket = `gs://modo-mapa-app.firebasestorage.app/backups/${timestamp}`;

  const [operation] = await client.exportDocuments({
    name: 'projects/modo-mapa-app/databases/(default)',
    outputUriPrefix: bucket,
  });

  // 3. Esperar a que termine (o devolver operation name para polling)
  const [response] = await operation.promise();

  return {
    id: timestamp,
    outputUri: response.outputUriPrefix,
    startTime: response.startTime,
    endTime: response.endTime,
  };
});
```

### listBackups

```typescript
export const listBackups = onCall(async (request) => {
  // 1. Verificar admin
  if (request.auth?.token.email !== 'benoffi11@gmail.com') {
    throw new HttpsError('permission-denied', 'Solo admin');
  }

  // 2. Listar carpetas en el bucket de backups
  const { Storage } = await import('@google-cloud/storage');
  const storage = new Storage();
  const bucket = storage.bucket('modo-mapa-app.firebasestorage.app');

  const [files] = await bucket.getFiles({ prefix: 'backups/', delimiter: '/' });

  // Agrupar por prefijo (cada backup es una carpeta)
  const prefixes = new Set<string>();
  for (const file of files) {
    const parts = file.name.split('/');
    if (parts.length >= 2 && parts[1]) {
      prefixes.add(parts[1]);
    }
  }

  // Alternativa: usar getFiles con autoPaginate y apiResponse.prefixes
  // para obtener las carpetas directamente

  return {
    backups: [...prefixes].map((id) => ({
      id,
      uri: `gs://modo-mapa-app.firebasestorage.app/backups/${id}`,
      createdAt: id.replace(/T/, ' ').replace(/-(\d{2})-(\d{2})-(\d+)Z/, ':$1:$2.$3Z'),
    })).sort((a, b) => b.id.localeCompare(a.id)),
  };
});
```

### restoreBackup

```typescript
export const restoreBackup = onCall({
  timeoutSeconds: 300,
  memory: '256MiB',
}, async (request) => {
  // 1. Verificar admin
  if (request.auth?.token.email !== 'benoffi11@gmail.com') {
    throw new HttpsError('permission-denied', 'Solo admin');
  }

  const { backupUri } = request.data as { backupUri: string };
  if (!backupUri?.startsWith('gs://modo-mapa-app.firebasestorage.app/backups/')) {
    throw new HttpsError('invalid-argument', 'URI de backup inválido');
  }

  // 2. Ejecutar import
  const client = new FirestoreAdminClient();
  const [operation] = await client.importDocuments({
    name: 'projects/modo-mapa-app/databases/(default)',
    inputUriPrefix: backupUri,
  });

  const [response] = await operation.promise();

  return {
    success: true,
    startTime: response.startTime,
    endTime: response.endTime,
  };
});
```

---

## Frontend

### BackupsPanel component

```text
src/components/admin/BackupsPanel.tsx
```

Nuevo tab en `AdminLayout` (pestaña "Backups").

#### Estado

```typescript
interface BackupEntry {
  id: string;
  uri: string;
  createdAt: string;
}

const [backups, setBackups] = useState<BackupEntry[]>([]);
const [loading, setLoading] = useState(true);
const [operating, setOperating] = useState(false);
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState<string | null>(null);
const [confirmRestore, setConfirmRestore] = useState<BackupEntry | null>(null);
```

#### UI

```text
┌─────────────────────────────────────────────────┐
│ [Crear backup]  (Button, disabled si operating) │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Fecha              │ Estado │ Acciones      │ │
│ ├────────────────────┼────────┼───────────────┤ │
│ │ 2026-03-11 20:30   │ ✓      │ [Restaurar]   │ │
│ │ 2026-03-10 15:00   │ ✓      │ [Restaurar]   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ {error && <Alert severity="error">}             │
│ {success && <Alert severity="success">}         │
└─────────────────────────────────────────────────┘
```

#### Diálogo de confirmación (restaurar)

```text
┌──────────────────────────────────────┐
│ ⚠️ Restaurar backup                  │
│                                      │
│ Esta acción sobrescribirá los datos  │
│ actuales con el backup del           │
│ 2026-03-11 20:30.                    │
│                                      │
│ Esta operación NO es reversible.     │
│                                      │
│         [Cancelar]  [Restaurar]      │
└──────────────────────────────────────┘
```

#### Llamadas a Cloud Functions

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const createBackupFn = httpsCallable(functions, 'createBackup');
const listBackupsFn = httpsCallable(functions, 'listBackups');
const restoreBackupFn = httpsCallable(functions, 'restoreBackup');
```

---

## AdminLayout — Agregar tab

En `AdminLayout.tsx`, agregar la pestaña "Backups" al final de los tabs existentes:

```typescript
// Nuevo tab index (actualmente hay 7 tabs: 0-6, Backups sería 7)
{tabIndex === 7 && <BackupsPanel />}
```

---

## Permisos requeridos

El service account del proyecto necesita los roles:

- `roles/datastore.importExportAdmin` — para export/import de Firestore
- `roles/storage.admin` — para escribir/leer en el bucket de Cloud Storage

Verificar en la consola de Google Cloud IAM que el service account de Firebase tenga estos roles.

---

## Archivos a crear/modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `functions/src/admin/backups.ts` | Crear | 3 Cloud Functions callable |
| `functions/src/index.ts` | Modificar | Exportar las nuevas functions |
| `src/components/admin/BackupsPanel.tsx` | Crear | UI de gestión de backups |
| `src/components/admin/AdminLayout.tsx` | Modificar | Agregar tab "Backups" |
| `src/config/firebase.ts` | Verificar | Asegurar que Functions está configurado |

---

## Testing

- [ ] `createBackup` crea export en Cloud Storage
- [ ] `listBackups` retorna la lista de backups ordenada
- [ ] `restoreBackup` importa datos correctamente
- [ ] Verificar permisos: solo admin puede ejecutar las functions
- [ ] UI muestra estados de carga y errores
- [ ] Diálogo de confirmación funciona antes de restaurar
- [ ] Operaciones no se pueden ejecutar en paralelo (botón disabled)
