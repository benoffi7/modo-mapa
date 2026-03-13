# Reporte de Seguridad — Backups de Firestore (Post-Mejoras)

**Feature:** Gestion de backups de Firestore desde /admin
**Issue:** [#34](https://github.com/benoffi7/modo-mapa/issues/34)
**Fecha del analisis original:** 2026-03-12
**Fecha de re-evaluacion:** 2026-03-12
**Alcance:** Cloud Functions (`createBackup`, `listBackups`, `restoreBackup`, `deleteBackup`), frontend (`BackupsPanel.tsx`), configuracion de Firebase y CSP

---

## Resumen ejecutivo

Este reporte es una re-evaluacion de la postura de seguridad de la funcionalidad de backups, realizada despues de aplicar las mejoras recomendadas en el informe original. De los 10 hallazgos accionables identificados originalmente (2 altos, 4 medios, 4 bajos), **8 fueron corregidos completamente** y **2 fueron parcialmente abordados**. No se identificaron vulnerabilidades nuevas de severidad alta o media. La postura general mejoro significativamente.

**Postura general:** Buena. Las mejoras implementadas cubren las principales areas de riesgo identificadas. Los hallazgos pendientes son de bajo impacto y aceptables para el modelo de amenaza del proyecto (single-admin).

---

## Resumen de cambios desde el ultimo informe

Las siguientes mejoras fueron implementadas en el backend (`functions/src/admin/backups.ts`) y frontend (`src/components/admin/BackupsPanel.tsx`):

1. **App Check enforced** en las 4 funciones (`enforceAppCheck: true`) - corrige H-01
2. **Rate limiting in-memory** implementado (5 llamadas por minuto por UID) con `checkRateLimit()` - corrige H-02
3. **Verificacion de `email_verified`** agregada en `verifyAdmin()` - corrige M-01
4. **Backup de seguridad automatico pre-restore** creado antes de cada restauracion - corrige M-02
5. **URIs de buckets ya no se exponen al frontend**: `createBackup` retorna solo `id` y `createdAt`; `restoreBackup` recibe solo `backupId` y construye la URI internamente; `listBackups` retorna solo `id` y `createdAt` por backup - corrige M-03
6. **`listBackups` con timeout y memoria configurados** (`timeoutSeconds: 60`, `memory: '256MiB'`) - corrige M-04
7. **Email del admin externalizado** via `defineString('ADMIN_EMAIL')` con `firebase-functions/params` - corrige parcialmente L-01
8. **Logs usan email enmascarado** (`maskEmail()`) en lugar del email completo - corrige L-02
9. **`console.error` condicional en produccion** via `logError()` que solo loguea en `import.meta.env.DEV` - corrige L-03
10. **Funcion `deleteBackup` implementada** con validacion de admin, App Check y rate limiting - corrige L-04
11. **Validacion estricta de `backupId`** con regex `/^[\w.-]+$/` via `validateBackupId()` - mejora nueva
12. **Paginacion** en `listBackups` con `pageSize` acotado (1-100) y `pageToken` - mejora nueva
13. **Frontend mejorado**: mensajes de error mapeados a mensajes amigables, dialogo de confirmacion para delete, auto-dismiss de alertas de exito

---

## Re-evaluacion de hallazgos originales

### Severidad Alta

#### H-01: App Check no esta enforced en las Cloud Functions de backup

**Estado:** Corregido

**Antes:** Ninguna de las funciones tenia `enforceAppCheck: true`. App Check era puramente del lado del cliente.

**Despues:** Las 4 funciones (`createBackup`, `listBackups`, `restoreBackup`, `deleteBackup`) incluyen `enforceAppCheck: true` en sus opciones de `onCall`. Esto significa que llamadas desde clientes que no presenten un token valido de App Check seran rechazadas por Firebase antes de ejecutar el codigo de la funcion.

**Nota:** La efectividad de esta mejora depende de que App Check este en modo "enforce" en Firebase Console y de que `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` este configurada en produccion. La inicializacion condicional en `firebase.ts` (lineas 55-61) sigue siendo correcta para este modelo.

---

#### H-02: Sin rate limiting en funciones de backup

**Estado:** Corregido

**Antes:** Sin ningun mecanismo de rate limiting. Llamadas directas a las funciones podian ejecutarse sin limite.

**Despues:** Se implemento rate limiting in-memory con `checkRateLimit()`: maximo 5 llamadas por minuto por UID. Se aplica a todas las funciones a traves de `verifyAdmin()`. Al superar el limite, la funcion retorna `HttpsError('resource-exhausted')`.

**Limitacion residual:** El rate limiting es in-memory, lo que significa que se reinicia si la instancia de Cloud Functions se recicla o si hay multiples instancias concurrentes. Para el modelo single-admin del proyecto, esto es aceptable. Un rate limiting basado en Firestore o Redis seria mas robusto pero innecesario para la escala actual.

---

### Severidad Media

#### M-01: Autorizacion por email hardcodeado sin verificacion de email_verified

**Estado:** Corregido

**Antes:** `verifyAdmin()` solo comparaba `request.auth?.token.email` contra `ADMIN_EMAIL` sin verificar `email_verified`.

**Despues:** `verifyAdmin()` ahora verifica `email_verified` antes de comparar el email:

```typescript
if (!emailVerified) {
  throw new HttpsError('permission-denied', 'Email no verificado');
}
```

Esto previene que un atacante registre una cuenta con el email del admin sin verificarla y obtenga acceso a las funciones.

---

#### M-02: Sin backup previo automatico antes de restore

**Estado:** Corregido

**Antes:** `restoreBackup` ejecutaba `importDocuments` directamente sin crear un backup de seguridad previo.

**Despues:** Antes de cada restore, se crea automaticamente un backup con prefijo `pre-restore-` que contiene el timestamp. Esto permite revertir un restore accidental. El frontend tambien fue actualizado para informar al usuario: "Se creara un backup de seguridad automaticamente antes de restaurar."

---

#### M-03: URI de backup en respuesta al frontend expone infraestructura interna

**Estado:** Corregido

**Antes:** `createBackup` retornaba `outputUri` (incluyendo el nombre del bucket). `listBackups` retornaba `uri` por cada backup. El frontend recibia URIs completas como `gs://modo-mapa-app-backups/backups/...`.

**Despues:** Las respuestas al frontend solo contienen `id` y `createdAt`. Las URIs de Cloud Storage se construyen exclusivamente del lado del servidor:

- `createBackup` retorna `{ id, createdAt }`
- `listBackups` retorna `{ id, createdAt }` por backup (sin URI)
- `restoreBackup` recibe solo `backupId` y construye la URI internamente
- `deleteBackup` recibe solo `backupId` y construye el prefijo internamente

El nombre del bucket ya no se expone al cliente en ningun momento.

---

#### M-04: listBackups no tiene limites de timeout ni memoria configurados

**Estado:** Corregido

**Antes:** `listBackups` no tenia opciones de configuracion.

**Despues:** `listBackups` tiene `timeoutSeconds: 60` y `memory: '256MiB'` configurados explicitamente. Ademas, la paginacion con `pageSize` acotado (max 100) limita el procesamiento por llamada.

---

### Severidad Baja

#### L-01: Email del admin hardcodeado como constante en codigo fuente

**Estado:** Parcialmente corregido

**Antes:** Email hardcodeado directamente como `const ADMIN_EMAIL = 'benoffi11@gmail.com'` en `backups.ts`.

**Despues:** El email se define via `defineString('ADMIN_EMAIL')` de `firebase-functions/params`, lo que permite configurarlo como variable de entorno sin modificar el codigo. Sin embargo:

- El valor default sigue siendo `benoffi11@gmail.com` en el codigo
- Las Firestore Security Rules probablemente siguen comparando contra el email directamente (fuera del alcance de este analisis)

Para una solucion completa, se recomienda migrar a Custom Claims (`request.auth.token.admin == true`) en Firestore Rules.

---

#### L-02: Logs contienen email del usuario

**Estado:** Corregido

**Antes:** Los logs registraban el email completo: `user: request.auth?.token.email`.

**Despues:** Se implemento `maskEmail()` que enmascara el email: `ben***@gmail.com`. Todas las funciones usan esta version enmascarada en sus logs. Esto reduce la exposicion de PII mientras mantiene suficiente informacion para auditar operaciones.

---

#### L-03: Error messages del frontend exponen detalles tecnicos en console.error

**Estado:** Corregido

**Antes:** `console.error` registraba errores completos en todos los entornos.

**Despues:** Se implemento `logError()` que solo loguea en desarrollo:

```typescript
function logError(context: string, err: unknown): void {
  if (import.meta.env.DEV) {
    console.error(`BackupsPanel: ${context}`, err);
  }
}
```

Ademas, los mensajes de error mostrados al usuario pasan por `mapErrorToUserMessage()` que traduce errores tecnicos a mensajes amigables y genericos.

---

#### L-04: Sin mecanismo de eliminacion de backups antiguos

**Estado:** Parcialmente corregido

**Antes:** No existia la funcionalidad de eliminar backups. Se acumulaban indefinidamente.

**Despues:** Se implemento la funcion `deleteBackup` con:

- Verificacion de admin + App Check + rate limiting
- Validacion estricta de `backupId` con regex
- Dialogo de confirmacion en el frontend con advertencia de irreversibilidad
- Logs de auditoria de la operacion

**Pendiente:** No se implemento una lifecycle policy automatica en Cloud Storage ni limpieza automatica de backups antiguos. La eliminacion sigue siendo manual.

---

### Severidad Informativa (sin cambios relevantes)

Los hallazgos informativos (I-01 a I-05) mantienen su estado original:

| ID | Titulo | Estado |
|----|--------|--------|
| I-01 | CSP headers correctos | OK - Sin cambios |
| I-02 | Security Rules no afectan backup/restore | OK - Sin cambios |
| I-03 | Dependencias actualizadas | OK - Sin cambios |
| I-04 | Timeout adecuado para escala actual | OK - Sin cambios |
| I-05 | Validacion de URI correcta | OK - Mejorada con `validateBackupId()` |

---

## Hallazgos nuevos

### N-01: Rate limiting in-memory no es persistente entre instancias (Informativo)

**Descripcion:** El rate limiting usa un `Map` en memoria de la instancia de Cloud Functions. Si Firebase escala a multiples instancias o recicla la instancia actual, el estado del rate limiter se pierde.

**Impacto:** Bajo. En el modelo single-admin, es improbable que se alcancen los limites de manera abusiva. El rate limiting funciona como una capa defensiva adicional, no como la unica proteccion.

**Recomendacion:** Aceptable para la escala actual. Si el proyecto escala a multiples admins, considerar migrar a un rate limiter basado en Firestore o Redis (ej: documento `config/rateLimit` con timestamp de ultima operacion).

---

### N-02: Funcion deleteBackup permite eliminacion sin periodo de gracia (Baja)

**Descripcion:** La funcion `deleteBackup` elimina archivos inmediatamente sin periodo de gracia ni soft-delete. Una vez eliminado, el backup no se puede recuperar.

**Impacto:** Bajo. El dialogo de confirmacion del frontend mitiga el riesgo de eliminacion accidental. Ademas, solo el admin puede ejecutar esta operacion.

**Recomendacion:** Considerar implementar soft-delete (mover a un prefijo `deleted/` en el bucket) con eliminacion definitiva despues de 7 dias, o habilitar Object Versioning en el bucket de Cloud Storage.

---

### N-03: Validacion de backupId con regex permite un rango amplio de caracteres (Informativo)

**Descripcion:** La regex `/^[\w.-]+$/` permite letras, numeros, guiones bajos, puntos y guiones. Esto es suficiente para prevenir path traversal (`../`) e inyeccion de URIs, pero es mas permisivo que el formato real de IDs generados (que siguen el patron ISO 8601 con guiones).

**Impacto:** Ninguno en la practica. La validacion es efectiva contra los ataques relevantes. Un ID que no corresponda a un backup real simplemente resultara en un error "not-found".

**Recomendacion:** Informativo. No requiere accion.

---

## Tabla resumen de hallazgos

| ID | Severidad | Titulo | Estado anterior | Estado actual |
|----|-----------|--------|-----------------|---------------|
| H-01 | Alta | App Check no enforced en funciones de backup | Abierto | Corregido |
| H-02 | Alta | Sin rate limiting en funciones de backup | Abierto | Corregido |
| M-01 | Media | Sin verificacion de email_verified | Abierto | Corregido |
| M-02 | Media | Sin backup automatico pre-restore | Abierto | Corregido |
| M-03 | Media | URI de backup expone infraestructura interna | Abierto | Corregido |
| M-04 | Media | listBackups sin timeout/memoria configurados | Abierto | Corregido |
| L-01 | Baja | Email admin hardcodeado | Abierto | Parcialmente corregido |
| L-02 | Baja | Logs contienen email (PII) | Abierto | Corregido |
| L-03 | Baja | console.error expone detalles en produccion | Abierto | Corregido |
| L-04 | Baja | Sin eliminacion de backups antiguos | Abierto | Parcialmente corregido |
| I-01 | Info | CSP headers correctos | OK | OK |
| I-02 | Info | Security Rules no afectan backup/restore | OK | OK |
| I-03 | Info | Dependencias actualizadas | OK | OK |
| I-04 | Info | Timeout adecuado para escala actual | OK | OK |
| I-05 | Info | Validacion de URI correcta | OK | OK (mejorada) |
| N-01 | Info | Rate limiting in-memory no persistente | -- | Nuevo (aceptable) |
| N-02 | Baja | deleteBackup sin periodo de gracia | -- | Nuevo (aceptable) |
| N-03 | Info | Regex de backupId permisiva | -- | Nuevo (informativo) |

---

## Hallazgos pendientes

Los siguientes items no fueron completamente resueltos:

### L-01: Email admin con valor default en codigo

**Que falta:** Aunque se externalizo con `defineString`, el valor default sigue en el codigo. Las Firestore Security Rules probablemente mantienen el email hardcodeado.

**Recomendacion:** Migrar a Firebase Custom Claims para una solucion unificada entre Cloud Functions y Security Rules.

**Prioridad:** Baja. Funcional y seguro para el modelo actual.

### L-04: Sin lifecycle policy automatica para backups

**Que falta:** La eliminacion de backups es manual. No hay limpieza automatica de backups antiguos en Cloud Storage.

**Recomendacion:**

- Configurar una [Object Lifecycle Management](https://cloud.google.com/storage/docs/lifecycle) policy en el bucket `modo-mapa-app-backups` para eliminar objetos con mas de 90 dias
- Alternativamente, implementar una Cloud Function scheduled que elimine backups con mas de N dias

**Prioridad:** Baja. El costo de almacenamiento es minimo para la frecuencia esperada de backups.

### N-02: deleteBackup sin soft-delete

**Que falta:** La eliminacion es permanente e inmediata.

**Recomendacion:** Evaluar si Object Versioning en el bucket es suficiente como red de seguridad.

**Prioridad:** Baja.

---

## Evaluacion de postura de seguridad

| Area | Antes | Despues | Notas |
|------|-------|---------|-------|
| Autenticacion/Autorizacion | Buena | Muy buena | `email_verified` + admin check + rate limiting |
| Validacion de input | Buena | Muy buena | Regex estricta para `backupId`, paginacion acotada |
| Error handling | Buena | Muy buena | Mensajes genericos al usuario, logs enmascarados, errores condicionados a DEV |
| CSP/Headers | Buena | Buena | Sin cambios necesarios |
| App Check | Deficiente | Buena | `enforceAppCheck: true` en todas las funciones |
| Rate limiting | Deficiente | Buena | In-memory, suficiente para single-admin |
| Logging/Auditoria | Aceptable | Buena | PII enmascarada, operaciones criticas logueadas |
| Permisos IAM | Aceptable | Aceptable | Sin cambios, roles correctos |
| Supply chain | Buena | Buena | Sin cambios necesarios |
| Proteccion de datos | Aceptable | Muy buena | Backup pre-restore, URIs no expuestas, delete disponible |

**Calificacion general: 9/10** -- Mejora significativa respecto al 7/10 original. Todas las vulnerabilidades de severidad alta y media fueron corregidas. Los hallazgos pendientes son de baja severidad y aceptables para el modelo de amenaza single-admin del proyecto. La implementacion es production-grade para su escala actual.
