# Plan de Implementación — Gestión de backups de Firestore

**Issue:** [#34](https://github.com/benoffi7/modo-mapa/issues/34)
**Fecha:** 2026-03-11

---

## Paso 1: Cloud Functions — Backend de backups

### 1.1 Instalar dependencias en functions/

```bash
cd functions && npm install @google-cloud/firestore @google-cloud/storage
```

### 1.2 Crear `functions/src/admin/backups.ts`

Implementar 3 callable functions:

- **`createBackup`**: valida admin → `FirestoreAdminClient.exportDocuments()` → retorna metadata
- **`listBackups`**: valida admin → lista prefijos en bucket `backups/` → retorna array ordenado
- **`restoreBackup`**: valida admin → valida URI → `FirestoreAdminClient.importDocuments()` → retorna resultado

### 1.3 Exportar en `functions/src/index.ts`

```typescript
export { createBackup, listBackups, restoreBackup } from './admin/backups';
```

### 1.4 Verificar build

```bash
cd functions && npm run build
```

---

## Paso 2: Frontend — BackupsPanel

### 2.1 Crear `src/components/admin/BackupsPanel.tsx`

- Estado: `backups`, `loading`, `operating`, `error`, `success`, `confirmRestore`
- `useEffect` al montar: llamar `listBackups` y poblar tabla
- Botón "Crear backup": llama `createBackup`, muestra loading, refresca lista
- Tabla con columnas: Fecha, Acciones (Restaurar)
- Diálogo de confirmación para restaurar con texto explícito

### 2.2 Configurar Firebase Functions en el cliente

Verificar que `src/config/firebase.ts` exporta la instancia de Functions. Si no existe, agregar:

```typescript
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
export const functions = getFunctions(app);
if (import.meta.env.DEV) {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

---

## Paso 3: Integrar en AdminLayout

### 3.1 Modificar `src/components/admin/AdminLayout.tsx`

- Agregar tab "Backups" (último tab)
- Import lazy de `BackupsPanel`
- Renderizar `BackupsPanel` en el tab correspondiente

---

## Paso 4: Permisos IAM

Verificar que el service account de Firebase tiene:

- `roles/datastore.importExportAdmin`
- `roles/storage.admin` (o al menos write en el bucket)

Esto se hace una sola vez en la consola de Google Cloud IAM.

---

## Paso 5: Deploy y test

### 5.1 Deploy functions

```bash
firebase deploy --only functions:createBackup,functions:listBackups,functions:restoreBackup --project modo-mapa-app
```

### 5.2 Test en producción

- [ ] Crear backup desde la UI → verificar que aparece en la lista
- [ ] Listar backups → verificar que muestra todos los existentes
- [ ] Restaurar un backup → verificar que los datos se restauran
- [ ] Intentar acceder sin ser admin → verificar permission-denied
- [ ] Verificar que el botón se deshabilita durante operaciones

---

## Orden de ejecución

| Paso | Descripción | Dependencia |
|------|-------------|-------------|
| 1 | Cloud Functions backend | Ninguna |
| 2 | BackupsPanel frontend | Paso 1 (types) |
| 3 | Integrar en AdminLayout | Paso 2 |
| 4 | Permisos IAM | Antes de test |
| 5 | Deploy y test | Pasos 1-4 |
