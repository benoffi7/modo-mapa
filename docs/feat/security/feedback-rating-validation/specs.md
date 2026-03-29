# Specs: Feedback Rating Validation

**PRD:** [prd.md](prd.md)
**Fecha:** 2026-03-28

---

## Modelo de datos

No hay cambios en el modelo de datos. El campo `rating` ya existe como campo opcional en la regla `create` de la coleccion `feedback` (dentro de `keys().hasOnly()`). La interface `Feedback` en `src/types/index.ts` actualmente no incluye `rating` -- el campo esta permitido en rules pero no se envia desde el frontend.

No se agrega `rating` a la interface TypeScript porque el frontend no lo usa actualmente. Si en el futuro se integra, debera agregarse como `rating?: number`.

## Firestore Rules

Modificar la regla `create` de `feedback` en `firestore.rules` para agregar validacion condicional del campo `rating`:

```rules
// Agregar despues de la linea de validacion de businessName:
&& (!('rating' in request.resource.data) || (request.resource.data.rating is int && request.resource.data.rating >= 1 && request.resource.data.rating <= 5))
```

Esto sigue el patron condicional existente en la misma regla para `businessId` y `businessName` (lineas 161-162 del archivo actual).

### Rules impact analysis

| Query (service file) | Collection | Auth context | Rule that allows it | Change needed? |
|---------------------|------------|-------------|-------------------|----------------|
| `sendFeedback(userId, message, category)` | feedback | Owner (create) | `allow create: if auth != null && userId == auth.uid` | No -- sendFeedback no envia `rating`, por lo que la condicion `!('rating' in ...)` es true |
| `fetchUserFeedback(userId)` | feedback | Owner (read) | `allow read: if resource.data.userId == auth.uid` | No |
| Admin read feedback | feedback | Admin | `allow read: if isAdmin()` | No |

### Field whitelist check

| Collection | New/modified field | In create `hasOnly()`? | In update `affectedKeys().hasOnly()`? | Rule change needed? |
|-----------|-------------------|----------------------|--------------------------------------|-------------------|
| feedback | rating (existing, no change) | YES (already listed) | N/A (not updatable by client) | No -- solo se agrega validacion de tipo/rango, no un campo nuevo |

## Cloud Functions

No se requieren cambios en Cloud Functions.

## Componentes

No hay cambios en componentes React.

### Mutable prop audit

No aplica -- no hay componentes modificados.

## Textos de usuario

No hay textos nuevos visibles al usuario.

## Hooks

No hay cambios en hooks.

## Servicios

No hay cambios en servicios.

## Integracion

Este cambio es exclusivamente en `firestore.rules`. No hay integracion con codigo frontend.

### Preventive checklist

- [x] **Service layer**: No aplica (no hay cambios en componentes/servicios)
- [x] **Duplicated constants**: No aplica
- [x] **Context-first data**: No aplica
- [x] **Silent .catch**: No aplica
- [x] **Stale props**: No aplica

## Tests

El proyecto no tiene un test suite de Firestore rules con `@firebase/rules-unit-testing` (confirmado: no existen archivos de test de rules). Se creara el primer archivo de tests de rules, enfocado en la coleccion `feedback`.

| Archivo test | Que testear | Tipo |
|-------------|-------------|------|
| `tests/rules/feedback.test.ts` | Validacion del campo `rating` en create de feedback: int 1-5 aceptado, fuera de rango rechazado, tipo incorrecto rechazado, feedback sin rating aceptado | Rules unit test |

### Casos a cubrir

- [x] Feedback con `rating: 3` (int valido) es aceptado
- [x] Feedback con `rating: 1` y `rating: 5` (limites) son aceptados
- [x] Feedback con `rating: 0` es rechazado (fuera de rango)
- [x] Feedback con `rating: 6` es rechazado (fuera de rango)
- [x] Feedback con `rating: -1` es rechazado (fuera de rango)
- [x] Feedback con `rating: 100` es rechazado (fuera de rango)
- [x] Feedback con `rating: "hola"` es rechazado (tipo incorrecto)
- [x] Feedback con `rating: 3.5` es rechazado (float, no int)
- [x] Feedback con `rating: { value: 3 }` es rechazado (map)
- [x] Feedback sin campo `rating` es aceptado (campo opcional)

### Mock strategy

- Usar `@firebase/rules-unit-testing` con emulador de Firestore
- `initializeTestEnvironment` con `firestore.rules` del proyecto
- Contexto autenticado con `testEnv.authenticatedContext(userId)`

### Criterio de aceptacion

- Cobertura de todos los paths condicionales (rating presente valido, rating presente invalido, rating ausente)
- Todos los 10 casos de test pasan

## Analytics

No se agregan eventos de analytics.

---

## Offline

No hay impacto offline. La validacion ocurre server-side en Firestore rules. La cola offline existente (`withOfflineSupport`) sigue funcionando sin cambios -- los datos del formulario ya se validan client-side antes de encolar.

### Cache strategy

N/A -- no hay cambios en lecturas.

### Writes offline

| Operacion | Mecanismo | Conflict resolution |
|-----------|-----------|-------------------|
| Enviar feedback (con o sin rating) | Cola offline existente | Sin cambio -- si el rating es invalido, Firestore rechazara el write al sincronizar |

### Fallback UI

N/A -- no hay cambios de UI.

---

## Decisiones tecnicas

1. **Solo validacion en `create`, no en `update`**: La regla de `update` de feedback solo permite admin (campos de status/response) y owner (viewedByUser, mediaUrl/mediaType). Ninguno de estos paths permite modificar `rating`, por lo que no se necesita validacion adicional en `update`.

2. **Patron condicional `!('field' in ...) || validacion`**: Reutilizamos el patron ya establecido en esta misma regla para `businessId` y `businessName`. Esto permite que `rating` siga siendo opcional.

3. **Primer test de rules del proyecto**: Se establece la infraestructura de testing de Firestore rules con `@firebase/rules-unit-testing`. Esto beneficiara a futuros fixes de seguridad que solo modifiquen rules.

4. **No agregar `rating` a la interface TypeScript**: El campo existe en rules pero no se usa en el frontend actualmente. Agregarlo a la interface sin un feature que lo consuma crearia confusion. Se documenta la decision para cuando se implemente el feature de rating de feedback.
