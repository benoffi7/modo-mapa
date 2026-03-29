# PRD: Security: campo rating en feedback sin validacion de tipo/rango

**Feature:** feedback-rating-validation
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #211
**Prioridad:** Alta

---

## Contexto

La coleccion `feedback` acepta un campo opcional `rating` en su regla `create` (listado en `keys().hasOnly()`), pero no valida su tipo ni rango. El proyecto ya aplica validaciones de tipo/rango para campos numericos en otras colecciones (ej: `score` 1-5 en ratings, `level` 1-3 en priceLevels), pero esta validacion se omitio en feedback. El campo `rating` se usa en el formulario de feedback para que el usuario califique su experiencia general con la app.

## Problema

- Un atacante puede escribir directamente a Firestore (bypasseando la UI) y guardar cualquier valor en `rating`: strings, maps, arrays, numeros negativos o numeros enormes.
- El codigo frontend y admin que lee `rating` asume que es un entero entre 1 y 5. Valores inesperados pueden causar crashes en la UI o corrupcion de datos en reportes del admin dashboard.
- El proyecto tiene como politica validar tipo y rango de todos los campos numericos en Firestore rules (documentado en `security.md` checklist). Este campo es una excepcion no intencionada.

## Solucion

### S1. Agregar validacion de tipo y rango en Firestore rules

Modificar la regla `create` de la coleccion `feedback` en `firestore.rules` para validar que si `rating` esta presente, sea un entero entre 1 y 5:

```
&& (!('rating' in request.resource.data) || (request.resource.data.rating is int && request.resource.data.rating >= 1 && request.resource.data.rating <= 5))
```

Esto sigue el patron existente usado para `businessId` y `businessName` en la misma regla (validacion condicional con `!('field' in ...)` para campos opcionales).

### S2. Agregar test de Firestore rules

Agregar test cases que verifiquen:

- Rating valido (1-5 int) es aceptado
- Rating fuera de rango (0, 6, -1, 100) es rechazado
- Rating de tipo incorrecto (string, map, float) es rechazado
- Feedback sin rating sigue siendo aceptado (campo opcional)

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Agregar validacion `rating is int && >= 1 && <= 5` en `firestore.rules` | Alta | S |
| Tests de Firestore rules para el campo rating | Alta | S |
| Actualizar `security.md` tabla de limites de validacion | Baja | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Migracion o limpieza de datos existentes con valores invalidos de `rating` (si los hubiera)
- Validacion client-side adicional (ya existe en el formulario de feedback)
- Cambios en el admin dashboard para manejar valores invalidos existentes
- Validacion de otros campos opcionales de feedback (`mediaUrl`, `mediaType`) que ya estan controlados por Storage rules

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `firestore.rules` | Rules test | Rating int 1-5 aceptado, rating fuera de rango rechazado, rating tipo incorrecto rechazado, feedback sin rating aceptado |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (rating presente valido, rating presente invalido, rating ausente)
- Side effects verificados: documentos con rating invalido no se pueden crear

---

## Seguridad

- [x] Firestore rules validan rango de valores numericos (`rating >= 1 && rating <= 5`)
- [x] Firestore rules validan tipo de dato (`rating is int`)
- [x] Campo opcional manejado con patron condicional (`!('rating' in ...) || validacion`)
- [x] Validacion server-side duplica la validacion client-side existente

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Enviar feedback con rating | write | Cola offline existente (`withOfflineSupport`) | Toast de confirmacion de encolado |

### Checklist offline

- [x] Reads de Firestore: no aplica (este fix es solo validacion de escritura)
- [x] Writes: la cola offline existente sigue funcionando, los datos del formulario ya se validan client-side antes de encolar
- [x] APIs externas: no aplica
- [x] UI: no aplica (no hay cambio de UI)
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: Ninguno

---

## Modularizacion

Este fix modifica unicamente `firestore.rules` (infraestructura). No hay cambios en componentes, hooks ni servicios.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no aplica, solo rules)
- [x] Componentes nuevos son reutilizables (no aplica, no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas (no aplica)
- [x] Cada prop de accion tiene un handler real (no aplica)

---

## Success Criteria

1. Un documento de feedback con `rating: "hola"` es rechazado por Firestore rules
2. Un documento de feedback con `rating: 0` o `rating: 6` es rechazado por Firestore rules
3. Un documento de feedback con `rating: 3` (int valido) es aceptado
4. Un documento de feedback sin campo `rating` sigue siendo aceptado
5. Tests automatizados cubren los 4 escenarios anteriores
