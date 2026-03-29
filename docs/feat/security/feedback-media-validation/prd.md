# PRD: mediaUrl en feedback sin validacion permite phishing/XSS

**Feature:** feedback-media-validation
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #212
**Prioridad:** Alta

---

## Contexto

El sistema de feedback permite a los usuarios adjuntar archivos (imagenes y PDFs) que se suben a Firebase Storage. La URL resultante se guarda en el campo `mediaUrl` del documento de feedback. Sin embargo, las Firestore rules actuales no validan el formato de `mediaUrl`, permitiendo que un owner escriba una URL arbitraria via la regla de update que permite `affectedKeys().hasOnly(['mediaUrl', 'mediaType'])`. Tanto el admin dashboard (`FeedbackList.tsx`) como la vista del usuario (`MyFeedbackList.tsx`) renderizan `mediaUrl` directamente como `src` de imagen o `href` de link.

## Problema

- Un owner puede llamar a `updateDoc` directamente (sin pasar por `sendFeedback`) y setear `mediaUrl` a cualquier string arbitrario: una URL de phishing, un `javascript:` URI, o un data URI con payload malicioso.
- El admin dashboard renderiza `mediaUrl` como `<img src={f.mediaUrl}>` y como `<Link href={f.mediaUrl}>`, lo que permite phishing dirigido al admin o inyeccion de contenido externo.
- `mediaType` no esta validado en Firestore rules, permitiendo valores fuera de `'image' | 'pdf'` que podrian causar comportamiento inesperado en la UI.

## Solucion

### S1. Validacion de `mediaUrl` en Firestore rules

Agregar validacion en la regla de create y update de `feedback` para que `mediaUrl`, si esta presente, matchee el patron de Firebase Storage download URLs del proyecto (`https://firebasestorage.googleapis.com/`). Validar que `mediaType` sea uno de `['image', 'pdf']`.

### S2. Sanitizacion en frontend (defensa en profundidad)

Agregar una funcion utilitaria `isValidStorageUrl(url: string): boolean` que valide que la URL es una Firebase Storage URL antes de renderizarla. Aplicar en `FeedbackList.tsx` y `MyFeedbackList.tsx`. Si la URL no es valida, no renderizar el media y mostrar un indicador de "Adjunto no disponible".

### S3. Restringir tipo en TypeScript

Cambiar `mediaType` en el tipo `Feedback` de `'image' | 'video' | 'pdf'` a `'image' | 'pdf'` (eliminando `'video'` que no se usa ni se soporta en Storage rules).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Validar `mediaUrl` como Firebase Storage URL en Firestore rules (create + update) | Alta | S |
| Validar `mediaType` como `'image'` o `'pdf'` en Firestore rules (create + update) | Alta | S |
| Crear util `isValidStorageUrl` en `src/utils/media.ts` | Alta | S |
| Aplicar sanitizacion en `FeedbackList.tsx` (admin) | Alta | S |
| Aplicar sanitizacion en `MyFeedbackList.tsx` (usuario) | Alta | S |
| Actualizar tipo `Feedback.mediaType` en `src/types/index.ts` | Baja | S |
| Tests para rules, util y componentes | Alta | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Migrar feedback media existente que ya tenga URLs invalidas (si existe alguno, el frontend simplemente no lo renderizara)
- Validacion de que el archivo en la URL realmente existe en Storage (verificacion costosa, innecesaria con la validacion de patron)
- Soporte para video en feedback media (no existe actualmente)
- Rate limiting adicional en updates de mediaUrl (ya tiene rate limit de 5/dia en create via trigger)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/utils/media.ts` (nuevo) | Util | URLs de Firebase Storage validas, URLs externas rechazadas, javascript: URIs, data: URIs, strings vacias, undefined |
| `firestore.rules` | Rules | Create con mediaUrl valida, create con mediaUrl invalida, update con mediaUrl valida, update con mediaUrl invalida, mediaType valido, mediaType invalido |
| `src/services/feedback.test.ts` | Service | Verificar que `sendFeedback` sigue funcionando con el flujo normal de upload |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (URLs rechazadas no se renderizan)

---

## Seguridad

- [x] **Stored XSS prevention:** `mediaUrl` validada contra patron de Firebase Storage URL en Firestore rules (server-side) y en frontend (client-side)
- [ ] Firestore rules: validar `mediaUrl` matchee `https://firebasestorage.googleapis.com/` en create y update
- [ ] Firestore rules: validar `mediaType` sea `'image'` o `'pdf'` en create y update
- [ ] Frontend: nunca renderizar `mediaUrl` sin validar — defensa en profundidad
- [ ] Sin `dangerouslySetInnerHTML`: no aplica, pero verificar que `href` y `src` solo reciban URLs validadas
- [ ] Links externos: `target="_blank"` y `rel="noopener"` ya presentes en FeedbackList (verificar que se mantengan)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Crear feedback con media | write | Firestore persistent cache (upload requiere conexion) | Upload falla con error de red; mensaje se encola, media no |
| Leer feedback con mediaUrl | read | Firestore persistent cache | Imagen ya cacheada por browser; si no, placeholder |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (Firestore persistent cache en prod)
- [x] Writes: upload de media requiere conexion, no es encolable offline (comportamiento actual, no cambia)
- [x] APIs externas: no hay llamadas externas nuevas
- [ ] UI: no se necesita indicador offline adicional (el existente cubre)
- [x] Datos criticos: feedback se cachea por Firestore persistent cache

### Esfuerzo offline adicional: S (sin cambios)

---

## Modularizacion

La solucion agrega una funcion utilitaria pura (`isValidStorageUrl`) sin dependencias de framework. Los componentes que la consumen (`FeedbackList`, `MyFeedbackList`) ya existen y solo necesitan un guard condicional antes de renderizar media.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (validacion en util puro, no inline en componentes)
- [x] Componentes nuevos son reutilizables fuera del contexto actual de layout (no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado

---

## Success Criteria

1. Un `updateDoc` con `mediaUrl` que no sea una Firebase Storage URL es rechazado por Firestore rules con `permission-denied`.
2. Un `updateDoc` con `mediaType` que no sea `'image'` o `'pdf'` es rechazado por Firestore rules.
3. El admin dashboard no renderiza ningun `<img src>` ni `<a href>` con URLs que no sean de Firebase Storage.
4. El flujo normal de enviar feedback con imagen adjunta sigue funcionando sin cambios.
5. Tests cubren URLs maliciosas (javascript:, data:, URLs externas) tanto en rules como en el util frontend.
