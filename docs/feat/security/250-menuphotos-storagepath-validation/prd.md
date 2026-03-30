# PRD: menuPhotos storagePath sin validar -- proxy de archivos privados

**Feature:** 250-menuphotos-storagepath-validation
**Categoria:** security
**Fecha:** 2026-03-30
**Issue:** #250
**Prioridad:** Critica

---

## Contexto

El campo `storagePath` en documentos de `menuPhotos` no tiene validacion de formato ni en Firestore rules ni en el trigger `onMenuPhotoCreated`. Un usuario malicioso puede crear un documento con un `storagePath` arbitrario apuntando a cualquier archivo del bucket de Storage, y la Cloud Function descargaria ese archivo via admin SDK (que bypasea Storage rules), convirtiendose en un proxy de archivos privados.

## Problema

- El campo `storagePath` en la regla `create` de `menuPhotos` no valida que el path siga el formato esperado (`menus/{userId}/{businessId}/{fileName}`).
- La Cloud Function `onMenuPhotoCreated` usa admin SDK para descargar el archivo referenciado por `storagePath`, sin verificar que el path sea valido.
- Un atacante puede explotar esto para leer archivos de otros usuarios (feedback-media, backups) o cualquier objeto del bucket.

## Solucion

### S1: Validacion en Firestore rules

Agregar validacion regex en la regla `create` de `menuPhotos` para que `storagePath` siga estrictamente el formato `menus/{userId}/{businessId}/{fileName}`:

- El segmento `{userId}` debe coincidir con `request.auth.uid`.
- Solo permitir extensiones de imagen (`jpg`, `jpeg`, `png`, `webp`).
- Longitud maxima razonable (ej: 200 caracteres).

### S2: Validacion en Cloud Function trigger

En `onMenuPhotoCreated`, antes de procesar el archivo:

- Validar que `storagePath` comience con `menus/`.
- Validar que el segundo segmento del path coincida con el `userId` del documento.
- Rechazar y marcar como `rejected` si el path no cumple.

### S3: Validacion client-side

En `services/menuPhotos.ts`, asegurar que el `storagePath` se construye programaticamente (no como input del usuario) y sigue el patron esperado. Esto ya deberia ser asi, pero verificar que no haya forma de manipularlo.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Regex en Firestore rules para `storagePath` | P0 | S |
| Validacion en `onMenuPhotoCreated` trigger | P0 | S |
| Verificar construccion de path en `services/menuPhotos.ts` | P1 | S |
| Tests para la validacion en Cloud Function | P1 | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Migrar fotos existentes con paths legacy (`menus/{businessId}/{fileName}` sin userId).
- Cambiar el formato de storage path (mantener el actual `menus/{userId}/{businessId}/{fileName}`).
- Agregar firma de URLs (signed URLs) para descargas.
- Auditar otros campos de `menuPhotos` mas alla de `storagePath`.

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/triggers/menuPhotos.ts` | Trigger | Validacion de storagePath: formato correcto pasa, paths maliciosos se rechazan |
| `firestore.rules` | Rules | Regex en create de menuPhotos: paths validos aceptados, paths arbitrarios rechazados |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para storagePath con paths maliciosos (`../`, paths absolutos, paths a otras carpetas)
- Todos los paths condicionales cubiertos (path valido, path invalido, path sin userId correcto)
- Side effects verificados (documento marcado como rejected cuando path es invalido)

---

## Seguridad

- [x] Firestore rules: agregar regex para `storagePath` en `menuPhotos` create
- [ ] Validacion server-side en Cloud Function trigger
- [ ] Sin strings magicos: usar constantes para el prefijo de path esperado
- [ ] Validacion de input: storagePath validado tanto en rules como en trigger

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `menuPhotos` create | Inyeccion de `storagePath` arbitrario para leer archivos privados | Regex en rules + validacion en trigger |
| `menuPhotos` create | Path traversal (`../feedback-media/...`) | Regex que solo permita `menus/{uid}/...` |
| `menuPhotos` create | Spam de documentos con paths invalidos | Rate limit existente (10/dia) cubre esto |

- [x] Create rule tiene `hasOnly()` con whitelist de campos permitidos
- [ ] Agregar validacion de formato a `storagePath` en create rule
- [x] Rate limit server-side en Cloud Function trigger (10/dia)
- [ ] Validar userId en path coincide con auth.uid en rules

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #251 userSettings rules | independiente | No afecta, pero ambos son fixes de rules |

### Mitigacion incorporada

- Validacion de `storagePath` en Firestore rules cierra el vector de proxy de archivos privados.
- Validacion en trigger agrega defensa en profundidad.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Upload de foto de menu | write | Ya usa AbortController; offline no aplica (requiere Storage upload) | Mensaje de error de red existente |

### Checklist offline

- [x] Reads de Firestore: no aplica (la lectura de fotos es via Storage URL)
- [x] Writes: upload requiere conexion, no hay queue offline para fotos
- [x] APIs externas: no aplica
- [x] UI: no hay cambios de UI en este feature
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no inline en componentes de layout)
- [x] No se agregan componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Ningun archivo nuevo importa directamente de `firebase/firestore`
- [x] Cambios son en rules y Cloud Functions, no en componentes

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No hay cambios en componentes |
| Estado global | = | No hay cambios de estado |
| Firebase coupling | = | Cambios solo en rules y functions |
| Organizacion por dominio | = | Sin archivos nuevos en src/ |

---

## Success Criteria

1. Un documento `menuPhotos` con `storagePath` que no siga el formato `menus/{userId}/{businessId}/{fileName}` es rechazado por Firestore rules.
2. La Cloud Function `onMenuPhotoCreated` valida el `storagePath` y marca como rejected si es invalido.
3. El userId en el path debe coincidir con el `userId` del documento (y con `auth.uid` en rules).
4. Las fotos existentes con paths legacy siguen siendo legibles (read-only).
5. Tests cubren paths maliciosos: traversal, paths a otras carpetas, userId incorrecto.
