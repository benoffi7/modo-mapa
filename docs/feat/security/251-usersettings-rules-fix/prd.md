# PRD: userSettings rules -- followedTags + type validation + listItems delete

**Feature:** 251-usersettings-rules-fix
**Categoria:** security
**Fecha:** 2026-03-30
**Issue:** #251
**Prioridad:** Critica

---

## Contexto

La auditoria de seguridad SEC-34 identifico multiples vulnerabilidades en Firestore rules: campos de `userSettings` usados por el feature #205 (Seguir Tags) no estan en la whitelist de `keys().hasOnly()`, varios campos de notificaciones carecen de validacion de tipo, y el rate limit de `listItems` solo loguea pero no elimina documentos excedidos. Ademas, `sharedLists` acepta `color` e `icon` sin validar tipo ni longitud.

## Problema

- **SEC-34-02**: Los campos `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt` no estan en `keys().hasOnly()` de la regla de `userSettings`. El feature #205 (Seguir Tags) esta **roto en produccion** porque las escrituras son rechazadas por las rules.
- **SEC-34-03**: `notifyFollowers`, `notifyRecommendations`, `notificationDigest` no tienen validacion de tipo booleano/string. Un atacante puede inyectar tipos arbitrarios (objetos, arrays).
- **SEC-34-04**: El rate limit de `listItems` en `onListItemCreated` solo loguea la violacion pero no elimina el documento excedido, permitiendo spam ilimitado.
- **SEC-34-05**: Los campos `color` e `icon` en `sharedLists` no tienen validacion de tipo (string) ni longitud maxima, permitiendo inyeccion de datos arbitrarios.

## Solucion

### S1: Agregar followedTags fields a userSettings rules

Agregar los 3 campos faltantes a la whitelist de `keys().hasOnly()` en las reglas de `create` y `update` de `userSettings`:

- `followedTags`: validar que sea una lista (array) con longitud maxima razonable.
- `followedTagsUpdatedAt`: validar que sea timestamp del servidor.
- `followedTagsLastSeenAt`: validar que sea timestamp del servidor.

### S2: Validacion de tipo en campos de notificaciones

Agregar validaciones de tipo en las reglas de `userSettings`:

- `notifyFollowers`: `is bool`
- `notifyRecommendations`: `is bool`
- `notificationDigest`: `is string` con valores permitidos o longitud maxima

### S3: listItems rate limit enforcement

En `onListItemCreated`, cambiar el rate limit de log-only a enforcement: eliminar el documento recien creado si excede el limite diario (100/dia).

### S4: sharedLists color/icon validation

En las reglas de `sharedLists`:

- `color`: validar `is string` con longitud maxima (ej: 20 caracteres para hex + nombre de color).
- `icon`: validar `is string` con longitud maxima (ej: 50 caracteres para nombre de icono MUI).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Agregar followedTags fields a userSettings `keys().hasOnly()` | P0 | S |
| Validacion de tipo para notifyFollowers/notifyRecommendations/notificationDigest | P0 | S |
| listItems rate limit: delete en vez de log-only | P0 | S |
| sharedLists color/icon type + length validation | P1 | S |
| Tests para triggers y rules actualizadas | P1 | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactorizar toda la regla de `userSettings` (solo agregar campos faltantes y tipos).
- Migrar datos existentes con tipos incorrectos en notificaciones.
- Agregar validacion de valores especificos para `notificationDigest` (mas alla de tipo).
- Cambiar la estructura de `followedTags` (mantener el formato actual).

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `firestore.rules` | Rules | userSettings create/update con followedTags fields aceptados; tipos invalidos rechazados |
| `functions/src/triggers/listItems.ts` | Trigger | Rate limit enforcement: doc eliminado cuando excede 100/dia |
| `firestore.rules` | Rules | sharedLists create/update: color/icon validos aceptados, tipos invalidos rechazados |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para tipos incorrectos (objeto en vez de bool, array en vez de string)
- Verificar que followedTags fields permiten escritura (feature #205 funciona)
- Verificar que listItems rate limit elimina docs excedidos

---

## Seguridad

- [ ] Firestore rules: agregar followedTags* a `keys().hasOnly()` en userSettings
- [ ] Firestore rules: agregar `is bool` para campos de notificaciones en userSettings
- [ ] Firestore rules: agregar `is string` + longitud para color/icon en sharedLists
- [ ] Cloud Functions: cambiar listItems rate limit de log-only a delete

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| userSettings write | Inyeccion de campo arbitrario via followedTags bypass | Agregar campos a `keys().hasOnly()` |
| userSettings write | Tipo incorrecto en notifyFollowers (ej: objeto con payload) | Validacion `is bool` en rules |
| listItems create | Spam ilimitado de items (rate limit no enforcea) | Delete del doc excedido en trigger |
| sharedLists write | Inyeccion de HTML/scripts en color/icon | Validacion `is string` + longitud maxima |

- [x] Create rule tiene `hasOnly()` con whitelist de campos permitidos (pero incompleta -- este fix la completa)
- [ ] Update rule tiene `affectedKeys().hasOnly()` para userSettings -- verificar que incluya nuevos campos
- [ ] Rate limit server-side en listItems trigger: cambiar a enforcement
- [ ] Campos inmutables (userId) no estan en la lista de affectedKeys -- ya cubierto

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #250 menuPhotos storagePath | independiente | Ambos son fixes de rules, pueden deployarse juntos |
| #205 Seguir Tags | afecta | Este fix desbloquea el feature en produccion |

### Mitigacion incorporada

- Completar la whitelist de `keys().hasOnly()` en userSettings cierra la brecha abierta por #205.
- Cambiar listItems rate limit a enforcement previene spam.
- Validacion de tipos previene inyeccion de datos arbitrarios.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Escribir followedTags a userSettings | write | Firestore persistent cache maneja offline writes | Optimistic UI existente |
| Crear listItems | write | withOfflineSupport existente | Queue offline existente |

### Checklist offline

- [x] Reads de Firestore: no cambian
- [x] Writes: usan mecanismos offline existentes
- [x] APIs externas: no aplica
- [x] UI: no hay cambios de UI
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: S (ninguno)

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no aplica, cambios en rules y triggers)
- [x] No se agregan componentes nuevos
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Ningun archivo nuevo importa directamente de `firebase/firestore`
- [x] Cambios son en rules y Cloud Functions

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No hay cambios en componentes |
| Estado global | = | No hay cambios de estado |
| Firebase coupling | = | Cambios solo en rules y functions |
| Organizacion por dominio | = | Sin archivos nuevos en src/ |

---

## Success Criteria

1. Escribir `followedTags`, `followedTagsUpdatedAt`, `followedTagsLastSeenAt` a `userSettings` es aceptado por Firestore rules (feature #205 funciona).
2. Escribir `notifyFollowers: "malicious"` (tipo incorrecto) a `userSettings` es rechazado por rules.
3. Crear un `listItem` que exceda el rate limit de 100/dia resulta en la eliminacion automatica del documento.
4. Escribir `color: { nested: "object" }` a `sharedLists` es rechazado por rules.
5. Tests verifican todos los escenarios de aceptacion y rechazo.
