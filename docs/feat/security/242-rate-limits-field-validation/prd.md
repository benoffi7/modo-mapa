# PRD: Security: rate limit menuPhotos trigger + sharedLists field validation

**Feature:** 242-rate-limits-field-validation
**Categoria:** security
**Fecha:** 2026-03-29
**Issue:** #242
**Prioridad:** Alta

---

## Contexto

Una auditoria de seguridad post-v2.32.0 detecto tres brechas pendientes: el trigger `onMenuPhotoCreated` no tiene rate limiting server-side (H3), la regla de update de `sharedLists` no valida longitud de `name`/`description` (H2), y la coleccion `listItems` no tiene triggers de rate limiting (H4). Las tres permiten abuso automatizado que puede generar costos de billing o degradar la experiencia de otros usuarios.

## Problema

- **menuPhotos trigger sin rate limit** (H3): `onMenuPhotoCreated` procesa imagenes (genera thumbnail) sin `checkRateLimit()`. Un atacante puede subir fotos concurrentes para amplificar el consumo de Cloud Functions y Storage, incrementando costos de billing.
- **sharedLists update sin validacion de tipo/tamano** (H2): la regla de update permite `name` y `description` de largo ilimitado. Un atacante puede inyectar payloads grandes que afectan a otros usuarios que ven listas publicas, degradando performance y UX.
- **listItems sin triggers de rate limiting** (H4): no hay triggers para `listItems`. Create/delete en loop amplifica writes de Firestore sin control.

## Solucion

### S1. Agregar `checkRateLimit()` a `onMenuPhotoCreated`

Agregar rate limiting de 10 fotos/dia por usuario al trigger `onMenuPhotoCreated` en `functions/src/triggers/menuPhotos.ts`. Sigue el patron existente de `checkRateLimit()` usado en triggers de comments, commentLikes, customTags, favorites, priceLevels, ratings y userTags. Si excede el limite, loggear abuso y salir del trigger sin procesar la imagen.

### S2. Agregar validacion de longitud en sharedLists update rule

Modificar la regla de update de `sharedLists` en `firestore.rules` para validar:
- `name.size() <= 50`
- `description.size() <= 200`

Esto se alinea con el patron de limites de validacion existente (displayName 30, comment text 500, feedback message 1000).

### S3. Agregar trigger con rate limit para listItems

Crear trigger `onListItemCreated` en Cloud Functions que valide rate limit (100/dia por usuario, alineado con favorites). Si excede, loggear abuso. No bloquear la escritura (ya fue aceptada por rules) pero loggear para detectar abuso.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Agregar `checkRateLimit()` a `onMenuPhotoCreated` (10/dia) | Must | S |
| Agregar validacion `name.size() <= 50`, `description.size() <= 200` a sharedLists update rule | Must | S |
| Crear trigger `onListItemCreated` con rate limit (100/dia) | Should | S |
| Actualizar tests de `onMenuPhotoCreated` para cubrir rate limit | Must | S |
| Crear tests para trigger `onListItemCreated` | Should | S |
| Actualizar documentacion de security.md con nuevos rate limits | Should | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Rate limiting client-side para fotos (ya existe control visual en MenuPhotoUpload)
- Validacion client-side de longitud de nombre/descripcion de listas (deberia agregarse pero es un fix de UX separado)
- Rate limit para `onListItemDeleted` (menor riesgo ya que delete no amplifica billing)
- Migracion de listas existentes con nombres/descripciones largos

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `functions/src/triggers/menuPhotos.ts` | Unit | Rate limit check antes de procesamiento de imagen |
| `functions/src/triggers/menuPhotos.ts` | Unit | Que se salta el procesamiento si rate limit excedido |
| `functions/src/triggers/listItems.ts` (nuevo) | Unit | Rate limit check en create |
| `firestore.rules` | Manual | Rechazo de name > 50 y description > 200 en sharedLists update |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (rate limit docs creados, abuse logged)

---

## Seguridad

- [ ] `checkRateLimit()` en `onMenuPhotoCreated` usa el mismo patron que otros triggers (diario, por userId)
- [ ] Validacion de longitud en rules es server-side y no bypasseable
- [ ] Trigger de listItems usa `checkRateLimit()` consistente con otros triggers
- [ ] Actualizar tabla de rate limits en security.md

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `onMenuPhotoCreated` trigger | Billing amplification via uploads concurrentes | Rate limit 10/dia + checkRateLimit() |
| sharedLists update (Firestore) | Payload injection en name/description afectando viewers | Validacion de longitud en rules (50/200 chars) |
| listItems create (Firestore) | Write amplification en loop | Trigger con rate limit 100/dia |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #241 affectedKeys() update rules | Complementario | Ambos son fixes de seguridad en Firestore rules; #241 es mas critico |
| #237 Firestore rules field whitelist | Precedente | #237 audito creates; este issue cubre validacion de longitud en updates |

### Mitigacion incorporada

- Se cierra la brecha de rate limiting en menuPhotos (unica coleccion con trigger sin rate limit)
- Se agrega validacion de longitud a sharedLists (unica coleccion con campos de texto sin limite en rules)
- Se agrega cobertura de rate limiting a listItems (nueva coleccion sin triggers)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| menuPhoto create | write | Firestore persistent cache | Upload UI muestra error al reconectar si rate limit excedido |
| sharedList update | write | Firestore persistent cache | Optimistic UI; rechazo al sincronizar si longitud excede |
| listItem create | write | Firestore persistent cache | Optimistic UI |

### Checklist offline

- [x] Reads de Firestore: no aplica (solo cambios en writes)
- [x] Writes: las reglas de Firestore se evaluan al sincronizar; el trigger se ejecuta server-side
- [x] APIs externas: no aplica
- [x] UI: no hay cambios de UI (validacion server-side)
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

Este feature modifica `firestore.rules` y archivos en `functions/src/triggers/`. No hay cambios en el frontend.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (N/A - solo backend)
- [x] Componentes nuevos son reutilizables (N/A - no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore`
- [x] Archivos nuevos van en carpeta de dominio correcta (`functions/src/triggers/`)
- [x] Si el feature necesita estado global: N/A
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | Solo cambios backend |
| Estado global | = | Sin cambios |
| Firebase coupling | = | Sin cambios en frontend |
| Organizacion por dominio | = | Trigger nuevo en carpeta correcta |

---

## Success Criteria

1. `onMenuPhotoCreated` rechaza procesamiento cuando el usuario excede 10 fotos/dia, loggeando abuso
2. `sharedLists` update rule rechaza `name` > 50 chars y `description` > 200 chars
3. `onListItemCreated` trigger ejecuta rate limit check (100/dia por usuario)
4. Tests de menuPhotos trigger cubren el path de rate limit excedido
5. security.md actualizado con los nuevos rate limits
