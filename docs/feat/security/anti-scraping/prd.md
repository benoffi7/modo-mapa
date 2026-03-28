# PRD: Anti-scraping — Restringir lectura masiva via anonymous auth

**Feature:** anti-scraping
**Categoria:** security
**Fecha:** 2026-03-28
**Issue:** #213
**Prioridad:** Alta

---

## Contexto

Modo Mapa (v2.30.0) usa Firebase Anonymous Auth como acceso por defecto. Actualmente, 10 colecciones tienen reglas de lectura `allow read: if request.auth != null`, lo que significa que cualquier script que cree una sesion anonima puede paginar y extraer la totalidad del UGC (ratings, comentarios, tags, fotos, niveles de gasto, rankings, trending, specials, achievements, dailyMetrics). El proyecto ya completo 3 rondas de auditoria de seguridad y tiene App Check configurado, pero App Check no esta enforced para todas las operaciones y no impide scraping desde un cliente que pase el check.

## Problema

- **Extraccion completa de datos:** Un script puede crear una sesion anonima y usar `orderBy('createdAt').limit(500).startAfter(lastDoc)` para paginar colecciones enteras sin restriccion. No hay limites de lectura ni filtros obligatorios en las reglas.
- **Violacion de privacidad:** Colecciones como `favorites`, `commentLikes`, y `priceLevels` exponen comportamiento individual de usuarios a cualquier sesion autenticada, aunque ya tienen ownership en writes.
- **Riesgo competitivo:** Toda la data UGC (1131+ interacciones) podria ser clonada por un competidor con un script trivial.

## Solucion

### S1. Restringir reads en colecciones privadas a ownership

Colecciones donde los datos son inherentemente privados del usuario deben restringir lectura a `resource.data.userId == request.auth.uid` (o equivalente). Esto ya existe en `checkins`, `follows`, `notifications`, `recommendations`, `activityFeed`, `feedback`, y `userSettings`.

**Colecciones a restringir:**

| Coleccion | Read actual | Read propuesto | Justificacion |
|-----------|-------------|----------------|---------------|
| `favorites` | `auth` | `resource.data.userId == request.auth.uid` | Los favoritos son privados; el cliente solo consulta los propios |
| `commentLikes` | `auth` | `resource.data.userId == request.auth.uid` | El cliente solo necesita saber si el usuario actual dio like |

**Impacto en el cliente:** El frontend ya filtra por `userId` en ambos casos (`useBusinessData` usa `where('userId', '==', uid)` para likes, y favorites siempre filtra por owner). Ningun query existente se rompe.

**Excepcion para `commentLikes`:** `useOptimisticLikes` usa `fetchUserLikes` que hace `documentId('in')` con batches de IDs compuestos `{userId}__{commentId}`. Como el doc ID ya contiene el userId, el ownership check funciona. Sin embargo, el conteo de likes (likeCount) vive en el campo `likeCount` del comentario, no requiere leer los docs de `commentLikes` de otros usuarios.

### S2. Requerir filtros obligatorios en colecciones publicas

Para colecciones que necesitan ser leidas por todos los usuarios (ratings, comments, userTags, customTags, priceLevels, menuPhotos), restringir a queries que incluyan un filtro por `businessId`. Esto previene paginacion de coleccion completa.

**Estrategia:** Firestore rules no pueden validar `request.query` directamente (no existe esa API). La alternativa viable es:

- **Opcion A (recomendada): Collection group query restrictions.** Mover reads publicos a consultas scoped via `where('businessId', '==', x)`. Esto ya es el patron del cliente. Agregar App Check enforcement completo como barrera adicional.
- **Opcion B: Rate limiting de reads.** No es posible en Firestore rules (no hay counter de reads). Se descarta.
- **Opcion C: Cloud Functions como proxy de reads.** Excesivo overhead para el caso de uso. Se descarta para v1.

**Accion concreta:** Dado que Firestore rules no pueden forzar filtros en queries, la proteccion real viene de:

1. **App Check enforcement completo** — activar enforcement en Firestore Console para que solo la app real pueda leer.
2. **Indices restrictivos** — remover indices compuestos que faciliten paginacion global. Firestore sin indice rechaza queries con `orderBy` en campos no indexados automaticamente.
3. **Monitoreo** — agregar alerta admin cuando se detecten patrones de scraping (alto volumen de reads desde un UID anonimo).

### S3. Activar App Check enforcement en Firestore

App Check ya esta configurado con reCAPTCHA Enterprise en produccion, pero el enforcement a nivel Firestore no esta activado (solo se usa en Cloud Functions callable con `enforceAppCheck: !IS_EMULATOR`). Activar enforcement en Firebase Console > Firestore > App Check bloquea requests que no pasen el attestation, lo cual elimina el vector de scripts automatizados.

**Consideraciones:**

- Staging comparte deployment con produccion y no tiene reCAPTCHA key. Activar enforcement romperia staging. Evaluar opciones: (a) obtener key separada para staging, (b) usar debug token en staging, (c) aceptar que staging no funcione con Firestore enforcement y usar emuladores.
- El frontend ya inicializa App Check con `ReCaptchaEnterpriseProvider` en produccion. Activar enforcement no requiere cambios en el codigo del cliente.

### UX

No hay cambios visibles para el usuario final. Las queries del cliente ya filtran por `businessId` o `userId`, asi que los reads seguiran funcionando identicamente. Si un usuario legitimo ve un error por App Check (ej: navegador con reCAPTCHA bloqueado), el error boundary existente lo captura.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Restringir read de `favorites` a ownership | Must | S |
| Restringir read de `commentLikes` a ownership | Must | S |
| Activar App Check enforcement en Firestore (produccion) | Must | M |
| Resolver App Check para staging (debug token o key separada) | Must | M |
| Agregar alerta admin para patrones de scraping (reads anomalos) | Should | L |
| Auditar queries del cliente para confirmar que todas filtran por businessId/userId | Must | M |
| Documentar cambios en `security.md` y reglas por coleccion | Must | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Migrar reads publicos a Cloud Functions proxy (overengineering para el volumen actual)
- Rate limiting de Firestore reads (no soportado por Firestore rules)
- Eliminar anonymous auth (es un requisito de producto, los usuarios acceden sin registro)
- Encriptar datos en Firestore (no aplica al vector de ataque descrito)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `firestore.rules` | Firestore rules (emulator) | Que `favorites` y `commentLikes` rechacen lectura de docs ajenos; que queries existentes del cliente sigan funcionando con filtros por userId |
| `src/services/favorites.ts` | Service unit | Confirmar que todas las queries incluyen `where('userId', '==', uid)` |
| `src/services/comments.ts` | Service unit | Confirmar que `fetchUserLikes` solo lee likes del usuario actual |
| `src/hooks/useBusinessData.ts` | Hook unit | Verificar que el refetch no intenta leer likes/favorites de otros usuarios |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (cache, analytics, notifications)
- **Tests de rules criticos:** verificar que un usuario anonimo B no pueda leer favoritos/likes del usuario A

---

## Seguridad

- [x] Firestore rules validan ownership en reads de `favorites` y `commentLikes`
- [ ] App Check enforcement activado en Firestore Console (produccion)
- [ ] Staging funciona con debug token o key separada post-enforcement
- [ ] Indices de Firestore auditados para remover los que faciliten paginacion global
- [ ] No se exponen datos de usuarios en colecciones con read global (`users` ya es `auth` — evaluar si expone demasiado)
- [ ] Reads de `users` collection: evaluar si deberia restringirse a ownership + admin (actualmente `auth`)

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| Read favorites propios | read | Firestore persistent cache ya lo maneja | Datos de cache, StaleBanner |
| Read commentLikes propios | read | Firestore persistent cache ya lo maneja | Datos de cache |
| App Check token refresh | read | Token cacheado por SDK, expira ~1h | Error boundary si token no disponible |

### Checklist offline

- [x] Reads de Firestore: usan persistencia offline (persistent cache habilitado en prod)
- [x] Writes: no aplica (este feature solo cambia reglas de read)
- [ ] APIs externas: App Check reCAPTCHA requiere conectividad para refresh de token
- [x] UI: OfflineIndicator ya existe para contextos relevantes
- [x] Datos criticos: disponibles en cache para primera carga

### Esfuerzo offline adicional: S

---

## Modularizacion

Este feature no agrega componentes ni hooks nuevos. Los cambios son exclusivamente en Firestore rules y configuracion de Firebase Console. La unica adicion de codigo posible es una alerta admin para scraping, que seguiria el patron existente de `AbuseAlerts` en el admin panel.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (no aplica, solo rules)
- [x] Componentes nuevos son reutilizables (no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas a contextos de layout
- [x] Cada prop de accion tiene un handler real especificado

---

## Success Criteria

1. Un script con sesion anonima no puede leer favoritos ni likes de otros usuarios (verificado con Firestore emulator tests)
2. App Check enforcement esta activo en Firestore para produccion, bloqueando requests sin attestation
3. Staging sigue funcionando con una solucion de debug token o key separada
4. Todas las queries existentes del cliente siguen funcionando sin errores (verificado con audit manual + tests)
5. La documentacion de seguridad (`security.md`) refleja los nuevos reads restrictivos y el estado de App Check enforcement
