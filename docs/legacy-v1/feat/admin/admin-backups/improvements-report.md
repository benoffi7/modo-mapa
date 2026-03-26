# Informe de Mejoras — Feature de Backups de Firestore

**Issue:** [#34](https://github.com/benoffi7/modo-mapa/issues/34)
**PR:** [#35](https://github.com/benoffi7/modo-mapa/pull/35)
**Fecha del analisis:** 2026-03-12

---

## Resumen ejecutivo

El feature de backups de Firestore (crear, listar, restaurar) esta implementado de forma funcional y cumple los requisitos del PRD. La arquitectura es correcta: operaciones server-side via Cloud Functions callable, UI en el panel admin, y validacion de permisos por email.

Sin embargo, se identifican **24 hallazgos** agrupados en 10 areas, con oportunidades significativas en: seguridad (email hardcodeado, validacion de inputs), mantenibilidad (duplicacion de logica de error, falta de tests), y UX (falta feedback de progreso en operaciones largas, sin paginacion, sin eliminacion de backups).

**Distribucion por prioridad:**

- **P0 (Critico):** 3 hallazgos
- **P1 (Alto):** 7 hallazgos
- **P2 (Medio):** 9 hallazgos
- **P3 (Bajo):** 5 hallazgos

---

## Hallazgos por area

### 1. Seguridad

#### SEC-1: Email de admin hardcodeado en Cloud Functions

- **Estado actual:** `ADMIN_EMAIL = 'benoffi11@gmail.com'` esta como constante en `backups.ts` linea 10. El mismo patron se repite en `AdminGuard.tsx` y Firestore rules.
- **Mejora propuesta:** Mover la lista de admins a una coleccion `config/admins` en Firestore o a una variable de entorno de Cloud Functions (`functions:config:set`). Esto permite agregar admins sin redesplegar.
- **Prioridad:** P1
- **Esfuerzo:** M

#### SEC-2: Validacion insuficiente de `backupUri` en restoreBackup

- **Estado actual:** Solo valida que el URI comience con `BACKUP_PREFIX` (linea 95). No valida que el backup realmente exista en el bucket antes de intentar el import.
- **Mejora propuesta:** Verificar existencia del prefijo en el bucket antes de llamar `importDocuments`. Agregar validacion de formato del timestamp en el URI para prevenir path traversal.
- **Prioridad:** P1
- **Esfuerzo:** S

#### SEC-3: No se valida autenticacion antes de verificar admin

- **Estado actual:** `verifyAdmin` recibe `request.auth?.token.email` pero no verifica primero que `request.auth` exista. Un usuario no autenticado recibe "permission-denied" en vez de "unauthenticated".
- **Mejora propuesta:** Agregar verificacion explicita de `request.auth` con `HttpsError('unauthenticated', ...)` antes de verificar el email.
- **Prioridad:** P2
- **Esfuerzo:** S

---

### 2. Calidad de codigo

#### COD-1: Logica duplicada de manejo de errores en el frontend

- **Estado actual:** `handleCreate`, `handleRestore` y `fetchBackups` en `BackupsPanel.tsx` repiten el mismo patron de parseo de errores (lineas 66-74, 93-100, 115-122): verificar si incluye "internal", "permission-denied", etc.
- **Mejora propuesta:** Extraer una funcion `parseBackupError(err: unknown, context: string): string` que centralice el mapeo de errores a mensajes amigables.
- **Prioridad:** P2
- **Esfuerzo:** S

#### COD-2: Creacion de FirestoreAdminClient dentro de cada funcion

- **Estado actual:** `createBackup` y `restoreBackup` crean `new v1.FirestoreAdminClient()` dentro del handler (lineas 28 y 102). Esto crea una nueva instancia en cada invocacion.
- **Mejora propuesta:** Instanciar el client una sola vez a nivel de modulo (lazy initialization) para reutilizarlo entre invocaciones en la misma instancia de Cloud Functions.
- **Prioridad:** P2
- **Esfuerzo:** S

#### COD-3: Doble inicializacion de firebase-admin

- **Estado actual:** `backups.ts` tiene `if (!admin.apps.length) { admin.initializeApp(); }` (lineas 6-8), pero `index.ts` ya llama `initializeApp()` incondicionalmente (linea 3). Esto genera una doble inicializacion condicional innecesaria.
- **Mejora propuesta:** Eliminar la inicializacion en `backups.ts` y confiar en la de `index.ts` que es el entry point.
- **Prioridad:** P0
- **Esfuerzo:** S

#### COD-4: Constantes magicas de proyecto

- **Estado actual:** `PROJECT_DB = 'projects/modo-mapa-app/databases/(default)'` y `BACKUP_BUCKET_NAME = 'modo-mapa-app-backups'` estan hardcodeadas. El bucket name ya tuvo problemas en produccion (cambio de `*.firebasestorage.app` a `*.appspot.com` segun changelog).
- **Mejora propuesta:** Derivar `PROJECT_DB` del project ID de la app inicializada. Para el bucket, usar variable de entorno o `defineString` de Firebase Functions v2.
- **Prioridad:** P1
- **Esfuerzo:** S

---

### 3. TypeScript

#### TS-1: Cast con `as` en lugar de validacion runtime

- **Estado actual:** `request.data as { backupUri: string }` en `restoreBackup` linea 94. No hay validacion de que `request.data` tenga la estructura esperada.
- **Mejora propuesta:** Usar un type guard o validacion explicita: verificar que `typeof request.data?.backupUri === 'string'` antes de usarlo.
- **Prioridad:** P1
- **Esfuerzo:** S

#### TS-2: Cast de apiResponse sin tipo seguro

- **Estado actual:** `(apiResponse as { prefixes?: string[] }).prefixes` en `listBackups` linea 66. El tipo real de la respuesta de la API de Storage no esta tipado.
- **Mejora propuesta:** Definir una interfaz `StorageApiResponse` o usar un type guard para validar la estructura. Documentar por que el cast es necesario (limitacion del SDK).
- **Prioridad:** P2
- **Esfuerzo:** S

#### TS-3: Tipado generico incompleto en httpsCallable del frontend

- **Estado actual:** `createBackupFn` y `restoreBackupFn` usan `httpsCallable` sin parametros de tipo (lineas 32, 34), mientras `listBackupsFn` si los tiene.
- **Mejora propuesta:** Tipar todas las funciones callable con sus tipos de request y response:

```typescript
const createBackupFn = httpsCallable<void, { id: string; outputUri: string }>(functions, 'createBackup');
const restoreBackupFn = httpsCallable<{ backupUri: string }, { success: boolean }>(functions, 'restoreBackup');
```

- **Prioridad:** P2
- **Esfuerzo:** S

---

### 4. Frontend (React / MUI)

#### FE-1: Sin feedback de progreso para operaciones largas

- **Estado actual:** Crear y restaurar backups pueden tomar hasta 5 minutos (timeout de 300s). El usuario solo ve "Procesando..." en el boton sin indicacion de progreso.
- **Mejora propuesta:** Agregar un indicador de tiempo transcurrido ("Procesando... (45s)") o un mensaje informativo ("Las operaciones de backup pueden demorar varios minutos"). Considerar un Snackbar persistente.
- **Prioridad:** P1
- **Esfuerzo:** S

#### FE-2: Sin paginacion en lista de backups

- **Estado actual:** Se cargan todos los backups de una vez. Con el tiempo, la lista puede crecer significativamente.
- **Mejora propuesta:** Implementar paginacion (client-side es suficiente dado que la API ya trae todos) o limitar a los ultimos N backups en el backend.
- **Prioridad:** P2
- **Esfuerzo:** M

#### FE-3: Sin opcion de eliminar backups

- **Estado actual:** El PRD lista "Eliminar backups antiguos" como RF-6 (prioridad baja). No esta implementado. Los backups se acumulan en Cloud Storage sin forma de limpiarlos desde la UI.
- **Mejora propuesta:** Agregar Cloud Function `deleteBackup` y boton de eliminar en la tabla con dialogo de confirmacion. Considerar tambien auto-limpieza (retener ultimos N backups).
- **Prioridad:** P1
- **Esfuerzo:** M

#### FE-4: Dialogo de confirmacion no bloquea doble click

- **Estado actual:** El boton "Restaurar" del dialogo de confirmacion no tiene estado `disabled` durante la operacion. Si el usuario hace doble click rapido, podria disparar la operacion dos veces.
- **Mejora propuesta:** Deshabilitar el boton "Restaurar" del dialogo mientras `operating` es true, o cerrar el dialogo inmediatamente al confirmar (ya se hace en linea 108, pero hay un race condition minimo).
- **Prioridad:** P2
- **Esfuerzo:** S

#### FE-5: Mensajes de exito/error no se auto-ocultan

- **Estado actual:** Los Alert de exito y error persisten hasta que el usuario los cierra manualmente o se inicia otra operacion.
- **Mejora propuesta:** Auto-ocultar el mensaje de exito despues de 5-10 segundos. Los errores pueden persistir para que el usuario tenga tiempo de leerlos.
- **Prioridad:** P3
- **Esfuerzo:** S

#### FE-6: Accesibilidad del dialogo de restauracion

- **Estado actual:** El dialogo no tiene `aria-describedby` explicito ni indica la severidad de la accion con un icono de warning.
- **Mejora propuesta:** Agregar icono de `Warning` de MUI en el titulo del dialogo. Asegurar que el foco se mueva al boton "Cancelar" al abrir (por ser la opcion segura). Agregar `aria-label` descriptivo.
- **Prioridad:** P3
- **Esfuerzo:** S

---

### 5. Backend (Cloud Functions)

#### BE-1: Sin backup automatico programado

- **Estado actual:** Solo backups manuales. Si el admin olvida crear backups, no hay red de seguridad.
- **Mejora propuesta:** Agregar una scheduled function (como `dailyMetrics`) que cree un backup diario/semanal automaticamente. Incluir logica de retencion (mantener ultimos 7 diarios + 4 semanales).
- **Prioridad:** P1
- **Esfuerzo:** M

#### BE-2: Sin logging estructurado de acciones de backup

- **Estado actual:** Se usa `logger.info/error/warn` con objetos de contexto. No se persiste un registro de auditorias de backups.
- **Mejora propuesta:** Crear una coleccion `backupLogs` en Firestore con: accion (create/restore), usuario, timestamp, resultado, duracion. Esto permite auditoria desde el dashboard.
- **Prioridad:** P2
- **Esfuerzo:** M

#### BE-3: Parseo fragil de timestamp desde nombre de carpeta

- **Estado actual:** `listBackups` reconstruye el `createdAt` desde el ID del backup usando regex (linea 74): `id.replace(/T/, ' ').replace(/-(\d{2})-(\d{2})-(\d+)Z/, ':$1:$2.$3Z')`. Esto es fragil y dependiente del formato exacto del timestamp.
- **Mejora propuesta:** Almacenar metadata del backup (fecha, tamano, estado) en un documento de Firestore al crear el backup. `listBackups` leeria de Firestore en vez de parsear nombres de carpetas.
- **Prioridad:** P2
- **Esfuerzo:** M

---

### 6. Performance

#### PERF-1: listBackups no tiene cache

- **Estado actual:** Cada vez que se monta `BackupsPanel`, llama a la Cloud Function que hace un request a la API de Storage.
- **Mejora propuesta:** Implementar cache client-side similar a `useBusinessDataCache` (TTL 2-5 min). Los backups no cambian frecuentemente, asi que un cache corto es suficiente.
- **Prioridad:** P3
- **Esfuerzo:** S

---

### 7. Testing

#### TEST-1: Sin tests unitarios ni de integracion

- **Estado actual:** No existen tests para las Cloud Functions de backup ni para `BackupsPanel`. Vitest esta configurado pero sin archivos de test para este feature.
- **Mejora propuesta:** Crear tests para:
  - **Cloud Functions:** mock de `FirestoreAdminClient` y `Storage`, verificar validacion admin, manejo de errores, formato de respuesta.
  - **Frontend:** mock de `httpsCallable`, verificar estados de carga, error, exito, dialogo de confirmacion.
- **Prioridad:** P0
- **Esfuerzo:** L

---

### 8. DevOps / Deployment

#### DEV-1: Cloud Functions no se despliegan en CI/CD

- **Estado actual:** Segun `PROJECT_REFERENCE.md`, las Cloud Functions se despliegan manualmente con `firebase deploy --only functions`. El workflow de GitHub Actions solo despliega Firestore rules + hosting.
- **Mejora propuesta:** Agregar deploy de Cloud Functions al workflow de CI/CD, idealmente con un job separado que solo corre cuando hay cambios en `functions/`. Esto evita olvidar deployar nuevas funciones.
- **Prioridad:** P0
- **Esfuerzo:** M

#### DEV-2: Sin monitoreo de backups fallidos

- **Estado actual:** Si un backup falla en produccion, solo se ve en los logs de Cloud Functions. No hay alertas automaticas.
- **Mejora propuesta:** Configurar Cloud Monitoring alerts para errores en las funciones de backup. Alternativamente, enviar una notificacion (email o webhook) cuando un backup programado falla.
- **Prioridad:** P1
- **Esfuerzo:** M

---

### 9. Documentacion

#### DOC-1: Falta documentacion de IAM y troubleshooting

- **Estado actual:** El changelog lista los fixes de produccion (CSP, bucket naming, IAM), pero no hay una guia consolidada de troubleshooting para el feature de backups.
- **Mejora propuesta:** Agregar seccion en `docs/SECURITY_GUIDELINES.md` o crear `docs/feat-admin-backups/troubleshooting.md` con: roles IAM requeridos, errores comunes y soluciones, bucket naming correcto.
- **Prioridad:** P3
- **Esfuerzo:** S

---

### 10. Funcional

#### FUNC-1: Sin pre-backup automatico antes de restaurar

- **Estado actual:** Al restaurar un backup, los datos actuales se sobrescriben sin crear un backup de seguridad previo.
- **Mejora propuesta:** Antes de ejecutar `importDocuments`, crear automaticamente un backup de seguridad etiquetado como "pre-restore-{timestamp}". Esto permite revertir una restauracion erronea.
- **Prioridad:** P1
- **Esfuerzo:** S

---

## Roadmap priorizado

### Fase 1 -- Criticos (P0) -- Sprint actual

| ID | Hallazgo | Esfuerzo |
|----|----------|----------|
| COD-3 | Eliminar doble inicializacion de firebase-admin | S |
| TEST-1 | Crear tests unitarios para Cloud Functions y frontend | L |
| DEV-1 | Agregar deploy de Cloud Functions a CI/CD | M |

### Fase 2 -- Alta prioridad (P1) -- Proximo sprint

| ID | Hallazgo | Esfuerzo |
|----|----------|----------|
| SEC-2 | Validar existencia de backup antes de restaurar | S |
| TS-1 | Reemplazar cast `as` con validacion runtime | S |
| COD-4 | Externalizar constantes de proyecto | S |
| FE-1 | Feedback de progreso para operaciones largas | S |
| FE-3 | Implementar eliminacion de backups | M |
| BE-1 | Backup automatico programado | M |
| DEV-2 | Monitoreo de backups fallidos | M |
| SEC-1 | Externalizar email de admin | M |
| FUNC-1 | Pre-backup automatico antes de restaurar | S |

### Fase 3 -- Prioridad media (P2) -- Backlog

| ID | Hallazgo | Esfuerzo |
|----|----------|----------|
| SEC-3 | Diferenciar unauthenticated de permission-denied | S |
| COD-1 | Centralizar logica de parseo de errores | S |
| COD-2 | Singleton de FirestoreAdminClient | S |
| TS-2 | Tipar apiResponse de Storage | S |
| TS-3 | Tipar httpsCallable completo | S |
| FE-2 | Paginacion de lista de backups | M |
| FE-4 | Prevenir doble click en dialogo de confirmacion | S |
| BE-2 | Logging de auditoria en Firestore | M |
| BE-3 | Metadata de backups en Firestore | M |

### Fase 4 -- Baja prioridad (P3) -- Nice to have

| ID | Hallazgo | Esfuerzo |
|----|----------|----------|
| FE-5 | Auto-ocultar mensajes de exito | S |
| FE-6 | Mejoras de accesibilidad en dialogo | S |
| PERF-1 | Cache client-side para listBackups | S |
| DOC-1 | Guia de troubleshooting de backups | S |

---

## Quick wins (alto impacto, bajo esfuerzo)

Cambios que se pueden implementar en menos de 30 minutos cada uno:

1. **COD-3** -- Eliminar `if (!admin.apps.length) { admin.initializeApp(); }` de `backups.ts`. Solo borrar las lineas 6-8. La inicializacion ya ocurre en `index.ts`.

2. **TS-1** -- Agregar validacion runtime en `restoreBackup`:

   ```typescript
   const backupUri = typeof request.data?.backupUri === 'string' ? request.data.backupUri : '';
   ```

3. **SEC-3** -- Mejorar `verifyAdmin` para diferenciar errores:

   ```typescript
   function verifyAdmin(auth: CallableRequest['auth']): void {
     if (!auth) {
       throw new HttpsError('unauthenticated', 'Autenticacion requerida');
     }
     if (auth.token.email !== ADMIN_EMAIL) {
       throw new HttpsError('permission-denied', 'Solo admin puede gestionar backups');
     }
   }
   ```

4. **TS-3** -- Agregar tipos a las funciones callable sin tipar (2 lineas).

5. **COD-2** -- Mover `new v1.FirestoreAdminClient()` a nivel de modulo con lazy init:

   ```typescript
   let _client: v1.FirestoreAdminClient | null = null;
   function getClient(): v1.FirestoreAdminClient {
     if (!_client) _client = new v1.FirestoreAdminClient();
     return _client;
   }
   ```

6. **FUNC-1** -- Agregar 3 lineas en `restoreBackup` antes del import para crear un backup de seguridad automatico.

7. **FE-4** -- Agregar `disabled={operating}` al boton "Restaurar" del dialogo de confirmacion.

---

## Conclusion

El feature de backups cumple su objetivo principal y fue desplegado exitosamente tras resolver problemas de CSP, bucket naming e IAM. Los hallazgos mas criticos son la falta de tests (TEST-1), la doble inicializacion de firebase-admin (COD-3) y la ausencia de deploy automatico de Cloud Functions (DEV-1). Las mejoras de Fase 1 y los quick wins se pueden completar en 1-2 sprints y elevarian significativamente la robustez y mantenibilidad del feature.
