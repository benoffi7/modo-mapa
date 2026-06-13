# PRD: Loading infinito en AuthContext ante fallo de lectura de perfil

**Feature:** loading-infinito-authcontext-perfil
**Categoria:** fix
**Fecha:** 2026-06-09
**Issue:** #341
**Prioridad:** Alta (correctness — bloqueo total de la app)

---

## Contexto

El callback de `onAuthStateChanged` en `src/context/AuthContext.tsx` (lineas 96-124) hace `await fetchUserProfileDoc(firebaseUser.uid)` sin try/catch, y `setIsLoading(false)` (linea 121) esta fuera de cualquier guard. Como AuthContext envuelve toda la app y el splash de loading depende de `isLoading`, cualquier rechazo de ese `getDoc` (regla de Firestore que deniega, error de red transitorio, primer arranque offline) deja la app atascada en pantalla de loading permanente, sin posibilidad de recuperarse salvo recarga manual.

## Problema

- `fetchUserProfileDoc` esta en el camino critico de autenticacion pero **no** tiene proteccion contra fallos: ni en el service (`userProfile.ts:131-135`) ni en el caller (`AuthContext.tsx:104`). Si el `getDoc` rechaza, el callback async lanza y `setIsLoading(false)` nunca se ejecuta → loading infinito.
- Contraste evidente: `fetchUserProfile` (la version agregada, `userProfile.ts:80-81`) **si** envuelve su `getDoc` con `.catch(() => null)` justamente porque sabe que la lectura del user doc puede fallar (las rules restringen lectura a owner/admin). La version del camino critico no heredo esa proteccion.
- Bug relacionado: `updateUserAvatar` (`userProfile.ts:158-161`) usa `updateDoc` sin fallback a `setDoc`, a diferencia de `updateUserDisplayName` (`userProfile.ts:141-153`) que si crea el doc si no existe. Si un usuario cambia el avatar antes de que exista su user doc, `updateDoc` lanza `not-found`, el optimistic update se revierte (`AuthContext.tsx:142`) y el avatar nunca persiste.

## Solucion

### S1 — Blindar el camino critico de auth (loading infinito)

El callback de `onAuthStateChanged` debe garantizar que `setIsLoading(false)` se ejecute siempre, pase lo que pase con la lectura del perfil.

- Envolver la lectura del perfil (`fetchUserProfileDoc`) en try/catch dentro del callback, y mover `setIsLoading(false)` a un `finally`. Tambien envolver el branch del `signInAnonymously` (que hoy ya tiene su propio try/catch interno) de modo que el `finally` cubra ambas ramas.
- Defense-in-depth en el service: agregar `.catch` en `fetchUserProfileDoc` para que devuelva `null` ante fallo, igual que `fetchUserProfile` ya hace. Esto alinea ambas funciones del service con el mismo contrato ("la lectura del user doc es best-effort, puede fallar"). El error se loguea via `logger.error` (siempre, nunca dentro de `if (DEV)` — patron #294) para que Sentry lo capture.
- Resultado esperado: ante un fallo de lectura de perfil, la app entra igual (sin `displayName`/`avatarId` cargados desde el doc; se rehidrataran en el proximo auth state change o cuando el usuario los setee). Nunca queda en loading infinito.

Patron de referencia: el branch de `signInAnonymously` (AuthContext.tsx:114-118) ya demuestra el estilo de manejo de error con `logger.error` sin re-throw. La diferencia es que ahi el error no rompia el flujo porque estaba aislado; el de `fetchUserProfileDoc` esta en el path principal sin aislamiento.

### S2 — `updateUserAvatar` con fallback setDoc (paridad con updateUserDisplayName)

`updateUserAvatar` debe seguir el mismo patron que `updateUserDisplayName`: chequear si el doc existe y hacer `setDoc` (con `createdAt: serverTimestamp()`) si no, o `updateDoc` si si.

**Restriccion confirmada en `firestore.rules` (lineas 22-43):** la regla de `create` de `users` HOY exige `displayName is string` con `size() > 0` y `<= 30`, ademas de `displayNameLower == displayName.lower()`. Es decir, un `setDoc` con solo `avatarId` + `createdAt` (sin displayName) seria **DENEGADO** por las rules. Esto es un dato duro, no una hipotesis. Por lo tanto el path "doc no existe → crear" de `updateUserAvatar` NO puede crear un doc solo-avatar bajo las rules actuales.

Caminos posibles (decision de producto + tecnica, ver mas abajo):

- **(a) Relajar la regla de create** para permitir un create solo-avatar: `displayName`/`displayNameLower` opcionales en el create siempre que ambos esten ausentes o ambos presentes-y-sincronizados. Mantiene `hasOnly` estricto y la invariante #322 R12. Es el camino preferido por el PRD por ser el mas limpio (un usuario puede legitimamente tener avatar antes que nombre).
- **(b) NO crear el doc en `updateUserAvatar`**: si el doc no existe, dejar el optimistic update en memoria (UI muestra el avatar) y persistirlo recien cuando exista displayName (o cuando el usuario lo setee). En este caso `updateUserAvatar` NO alcanza paridad total con `updateUserDisplayName` — solo evita el throw `not-found` capturando el error y dejando el estado optimista. El avatar se persiste en la proxima oportunidad.

**Decision requerida (Gonzalo):** ¿es valido que exista un user doc con avatarId pero sin displayName? Si SI → camino (a). Si NO (el displayName es el campo primario y el doc no debe existir sin el) → camino (b). El PRD recomienda (a) pero la decision afecta el modelo de datos y debe confirmarse antes de specs. Ver seccion "Decisiones pendientes".

### S4 — Aclaracion de comportamiento observable post-fix (auth transicional + multi-tab)

- **Estado transicional de auth:** tras el fix, si la lectura de perfil falla, `displayName`/`avatarId` quedan `null` momentaneamente. La app no re-dispara la lectura automaticamente (out of scope el retry). Se rehidratan en el proximo `onAuthStateChanged` (ej: token refresh) o cuando el usuario abre Ajustes/Perfil. Esto es identico al estado de un anonimo nuevo, ya soportado.
- **Multi-tab / multi-device:** el fix no introduce writes que compitan entre tabs mas alla de los ya existentes (`updateUserAvatar` ya existia). Dos tabs que escriben avatar concurrentemente es last-write-wins en un solo campo idempotente — no es un caso nuevo introducido por este PRD.
- **Sin loops de billing:** el fix solo agrega un `getDoc` que ya existia (no se agregan reads) y, en el camino (a)/(b), a lo sumo un `getDoc` de existencia en `updateUserAvatar` (que ya hace `updateUserDisplayName`). No hay listener nuevo ni trigger nuevo.

### S3 — UX: la app degrada con gracia, no bloquea

- No se agrega UI nueva. El comportamiento observable es: la app carga normalmente aunque el perfil no se pueda leer. `displayName`/`avatarId` quedan en `null` hasta que esten disponibles, lo que ya es un estado soportado por la app (usuarios anonimos nuevos arrancan asi).
- No hay cambios en SideMenu, AppShell ni ningun componente de layout. Es un fix acotado a `AuthContext.tsx` + `userProfile.ts` + `firestore.rules`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| S1: try/finally en callback de onAuthStateChanged | Alta | S |
| S1: `.catch` defensivo en `fetchUserProfileDoc` | Alta | S |
| S2: fallback setDoc en `updateUserAvatar` | Media | S |
| S2: ajustar `firestore.rules` users create para create solo-avatar | Media | S |
| Tests: AuthContext loading-false-on-profile-error | Alta | S |
| Tests: userProfile updateUserAvatar create/update paths | Media | S |
| Tests: rules users allow+deny create solo-avatar | Media | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Cambios de UI/UX visibles (banners de error de auth, retry button, etc.). El fix es de correctness, no de presentacion.
- Refactor del split AuthStateContext/AuthActionsContext o cualquier reorganizacion estructural de AuthContext.
- Retry/backoff de la lectura de perfil. El fix solo garantiza que la app no se cuelgue; no reintenta la lectura proactivamente (se rehidrata en el proximo auth state change).
- Cambios en `fetchUserProfile` (la version de agregacion del perfil publico) — ya tiene su `.catch`, no se toca.

---

## Tests

Politica del proyecto: cobertura >= 80% del codigo nuevo/modificado, paths condicionales cubiertos, side effects verificados (`docs/reference/tests.md`).

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/context/AuthContext.test.tsx` (existe, 35 casos) | Context | Nuevo caso: `fetchUserProfileDoc` rechaza → `isLoading` queda `false` (no infinito). Caso: rechaza → `displayName`/`avatarId` quedan `null` y la app no crashea. Verificar `logger.error` invocado. |
| `src/services/__tests__/userProfile.test.ts` (existe, 8 casos) | Service | `fetchUserProfileDoc` con `getDoc` que rechaza → devuelve `null` (no lanza). `updateUserAvatar`: doc existe → `updateDoc`; doc no existe → `setDoc` con `createdAt`. |
| `tests/rules/users.rules.test.ts` (existe, harness #332) | Rules | ALLOW: owner crea user doc solo con `avatarId` + `createdAt` (sin displayName). DENY: create con campo fuera del `hasOnly`. Marcar checkbox `users` allow+deny en inventario de tests.md. |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos (profile null, profile rechaza, doc existe/no existe)
- Side effects verificados (`logger.error` se llama, `setIsLoading(false)` siempre corre, optimistic revert de avatar solo en error real)

---

## Seguridad

Items relevantes del checklist (`docs/reference/security.md`):

- [ ] Si se toma el camino (a): el nuevo path de create de `users` (solo-avatar) mantiene `keys().hasOnly(['displayName','displayNameLower','avatarId','createdAt'])` como whitelist estricta — no agrega campos. La regla actual (firestore.rules:29) ya tiene este `hasOnly`; lo que cambia es relajar la **obligatoriedad** de `displayName`, no la whitelist.
- [ ] `createdAt == request.time` (timestamp server-side) se valida en el create solo-avatar.
- [ ] Ownership: `request.auth.uid == userId` (doc ID) se mantiene en el create.
- [ ] `logger.error` del catch NUNCA dentro de `if (import.meta.env.DEV)` (rompe Sentry — #294).
- [ ] El fix no expone datos de otros usuarios: la lectura sigue restringida a owner/admin; solo cambia el manejo de su fallo.

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| `users` create solo-avatar (path nuevo) | Crear docs `users/{otroUid}` con avatarId arbitrario | Regla ya valida `request.auth.uid == userId` (doc ID) — el create solo-avatar debe heredar el mismo guard, no relajarlo |
| `updateUserAvatar` (write) | Spam de writes a `users` | `users` no tiene trigger de rate limit hoy; el avatar es 1 campo idempotente por usuario. El riesgo es bajo (no es coleccion de items). No se introduce nueva superficie de items. |

El feature escribe a Firestore (`users` collection, path de create nuevo):

- [ ] Create rule tiene `hasOnly()` con whitelist de campos permitidos (ya existe: `['displayName','displayNameLower','avatarId','createdAt']`).
- [ ] CADA campo en `hasOnly()` tiene validacion de tipo. Verificar que `avatarId` valide `is string` y tenga limite de longitud razonable en la regla (los avatarIds son IDs cortos predefinidos — validar `is string` y `.size() <= 50`).
- [ ] (camino a) El create solo-avatar NO debe permitir saltear la sincronizacion `displayNameLower == displayName.lower()` (#322 R12): si el create no incluye `displayName`, tampoco debe incluir `displayNameLower`; la regla debe permitir ambos ausentes XOR ambos presentes-y-sincronizados en el create solo-avatar. Confirmado que la regla actual exige ambos presentes (firestore.rules:30-43) — el cambio debe ser preciso para no abrir un hueco de desincronizacion.
- [ ] `users` no requiere trigger de rate limit nuevo (no es coleccion de items escribibles masivamente; 1 doc por usuario, campos idempotentes).

`users` NO es userSettings — no aplica el checklist de userSettings. `avatarId` ya existe en el converter (`userConverters.ts`) y en las rules; no se agrega campo nuevo.

---

## Deuda tecnica y seguridad

Issues abiertos consultados: no existen labels `security` ni `tech debt` poblados; los issues de deuda usan label `enhancement` con prefijo "Tech debt:". Issues relevantes abiertos: #342 (deps vulnerables + secrets), #343-#349 (varios tech debt), #168 (Vite 8/ESLint 10).

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #344 (offline — profile mutations sin offline guard) | afecta | `setAvatarId`/`updateUserAvatar` es exactamente una "profile mutation". Coordinar para no pisar: este PRD agrega el fallback setDoc; #344 deberia agregar el offline guard sobre el mismo path. Documentar el cruce en specs. |
| #322 R12 (`displayNameLower == displayName.lower()` en users rules) | afecta | El nuevo path de create solo-avatar NO debe romper esta invariante. La regla debe permitir create sin `displayName`/`displayNameLower` (ambos ausentes) sin abrir un hueco donde se envie `displayNameLower` desincronizado. |
| #332 (rules tests harness) | mitiga | Aprovechar el harness existente (`users.rules.test.ts`) para agregar el test allow+deny del create solo-avatar y marcar el checkbox `users` en el inventario. |

### Mitigacion incorporada

- Alinear `fetchUserProfileDoc` con el contrato best-effort de `fetchUserProfile` (ambas funciones del mismo service tendran el mismo `.catch` defensivo) — elimina la inconsistencia que origino el bug.
- `updateUserAvatar` alcanza paridad con `updateUserDisplayName` (ambos crean el doc si no existe) — elimina la divergencia de comportamiento entre dos mutadores del mismo doc.

---

## Robustez del codigo

### Checklist de hooks async

- [ ] El `useEffect` de `onAuthStateChanged` ya retorna `unsubscribe` (cleanup). El callback async interno NO debe quedar sin `finally` para `setIsLoading(false)` — este es el core del fix.
- [ ] El callback de auth corre en respuesta a un listener (no es un fetch en mount); no necesita guard `cancelled` adicional, pero el `setIsLoading(false)` en `finally` es obligatorio.
- [ ] `setAvatarId` (handler async) ya tiene try/catch con revert optimista — verificar que tras el fix de `updateUserAvatar` (que ahora puede hacer `setDoc`) el revert siga siendo correcto.
- [ ] Funciones exportadas: `fetchUserProfileDoc` y `updateUserAvatar` se usan fuera del archivo (AuthContext) — mantener export.
- [ ] `logger.error` del catch NUNCA dentro de `if (import.meta.env.DEV)` (Sentry — #294).
- [ ] Archivos no superan 300/400 lineas: `AuthContext.tsx` y `userProfile.ts` estan holgados; el cambio es minimo.

### Checklist de observabilidad

- [ ] El `catch` del callback de auth y el `.catch` de `fetchUserProfileDoc` loguean via `logger.error` (Sentry en prod). Esto da visibilidad de cuantas veces falla la lectura de perfil en el camino critico — dato que hoy se pierde silenciosamente al colgarse la app.
- [ ] No se agregan `trackEvent` nuevos (no es necesario para un fix de correctness).
- [ ] `fetchUserProfileDoc` ya usa `measuredGetDoc('userProfile_doc', ...)` — la instrumentacion de perf se mantiene.

### Checklist offline

- [ ] El primer arranque offline es uno de los escenarios que dispara el bug (el `getDoc` rechaza por falta de red). El fix S1 lo cubre: la app entra igual.
- [ ] `updateUserAvatar` (write): coordinar con #344 para el offline guard. Este PRD no agrega el guard pero no lo bloquea.
- [ ] El `catch` muestra error solo via `logger.error` (no toast) — es correcto: la falla de lectura de perfil en el arranque no debe interrumpir al usuario con un toast; la app degrada con gracia.

### Checklist de documentacion

- [ ] No hay secciones nuevas de HomeScreen, analytics events, ni tipos nuevos.
- [ ] `docs/reference/patterns.md`: considerar agregar nota al patron "No silent .catch" / auth, explicitando que el camino critico de auth debe tener `finally` para `setIsLoading`.
- [ ] `docs/reference/tests.md`: marcar checkbox `users` allow+deny en el inventario de rules tests tras agregar el test del create solo-avatar.
- [ ] `docs/reference/firestore.md`: actualizar si el create solo-avatar implica documentar un nuevo path valido de create de `users`.

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| `fetchUserProfileDoc` en arranque | read | Firestore offline persistence (prod). Si falla igual → `.catch` devuelve `null`, app entra sin perfil | Ninguna (degrada silenciosamente, sin loading infinito) |
| `updateUserAvatar` | write | Hoy sin offline queue. Coordinar con #344 para `withOfflineSupport`. Este PRD: optimistic update local + revert si falla | Avatar se revierte si el write falla (comportamiento actual, mantenido) |

### Checklist offline

- [ ] Reads de Firestore: usan persistencia offline (prod, ya configurada). El fix garantiza que un fallo de lectura no cuelga la app.
- [ ] Writes: `updateUserAvatar` tiene optimistic UI + revert. Offline queue queda para #344.
- [ ] APIs externas: N/A (solo Firestore + Firebase Auth).
- [ ] UI: no se agrega indicador offline nuevo. El arranque offline ahora funciona en vez de colgarse.
- [ ] Datos criticos: la app no depende del user doc para arrancar — el fix lo confirma como best-effort.

### Esfuerzo offline adicional: S

---

## Modularizacion y % monolitico

### Checklist modularizacion

- [ ] Logica en service/context: el manejo de error vive en `userProfile.ts` (service) y `AuthContext.tsx` (context, capa permitida para usar servicios). No se agrega logica a componentes de layout.
- [ ] No se agregan componentes nuevos.
- [ ] No se agregan `useState` de logica de negocio a AppShell ni SideMenu.
- [ ] Sin props noop nuevas.
- [ ] AuthContext usa el service `userProfile.ts` para writes/reads — no importa `firebase/firestore` directamente para esta operacion (respeta la boundary; el SDK vive en el service).
- [ ] `firestore.rules` no es codigo de componente.
- [ ] Ningun archivo nuevo (solo modificaciones acotadas a 3 archivos existentes).

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | = | No se tocan componentes; solo context + service + rules |
| Estado global | = | Mismo estado de AuthContext (`isLoading`), sin nuevos campos |
| Firebase coupling | = | El SDK ya vive en `userProfile.ts`; el fix no mueve imports de Firebase |
| Organizacion por dominio | = | Cambios en archivos de su dominio correcto (context/, services/, rules) |

---

## Accesibilidad y UI mobile

No se agregan componentes interactivos ni copy nuevo. El fix es de correctness en la capa de datos/auth.

### Checklist de accesibilidad

- [ ] N/A — sin nuevos elementos interactivos.
- [ ] El splash de loading existente sigue igual; el unico cambio es que ahora siempre termina (deja de mostrarse) en vez de colgarse.

### Checklist de copy

- [ ] N/A — sin copy user-facing nuevo. Los mensajes de `logger.error` son internos (no user-facing), pero deben quedar claros para debugging (ej: `'[AuthContext] fetchUserProfileDoc failed on auth state change:'`).

---

## Success Criteria

1. Cuando `fetchUserProfileDoc` rechaza (rules deny, red, offline en arranque), `isLoading` pasa a `false` y la app renderiza normalmente — nunca queda en loading infinito.
2. El fallo de lectura de perfil queda registrado via `logger.error` (visible en Sentry en prod), en vez de perderse silenciosamente.
3. `updateUserAvatar` ya no lanza `not-found` sin manejar cuando el user doc no existe: segun el camino elegido (a o b), o crea el doc via `setDoc`, o deja el estado optimista sin throw no manejado. El avatar nunca queda en un estado donde el throw revierte la UI sin explicacion.
4. (Si camino a) La regla de `users` para el create solo-avatar mantiene la whitelist `hasOnly` estricta, ownership por doc ID, `createdAt` server-side, y la invariante `displayNameLower` (#322 R12) sin abrir nuevos huecos — verificado con test allow+deny.
5. Cobertura >= 80% del codigo modificado: tests de AuthContext (loading-false-on-error), userProfile (create/update + catch defensivo) y, si camino a, rules (allow+deny create solo-avatar).

---

## Decisiones pendientes (Gonzalo)

| # | Decision | Impacto si no se resuelve antes de specs |
|---|----------|------------------------------------------|
| D1 | ¿Es valido un user doc con `avatarId` sin `displayName`? (camino a vs b en S2) | El implementador inventaria el modelo de datos. Camino (a) requiere tocar `firestore.rules` + test rules; camino (b) no toca rules pero deja `updateUserAvatar` sin paridad total. Confirmado que la regla actual DENIEGA un create solo-avatar (firestore.rules:30-43). |

D1 es la unica decision de producto abierta. S1 (el fix del loading infinito, que es el core del issue) NO depende de D1 y puede implementarse de forma independiente. S2 depende de D1.

---

## Validacion Funcional

**Analista**: Sofia (checklist funcional aplicado por prd-writer; agente Sofia no spawneable en este contexto de ejecucion)
**Fecha**: 2026-06-09
**Estado**: VALIDADO CON OBSERVACIONES

### Hallazgos cerrados en esta iteracion

- BLOQUEANTE: "S2 asume que el create solo-avatar es posible bajo las rules actuales" → resuelto: se verifico `firestore.rules:30-43` y se confirmo que el create DENIEGA payloads sin `displayName`. S2 reescrito con caminos (a)/(b) explicitos y se levanto D1 como decision de producto.
- IMPORTANTE: "Estado transicional de auth no especificado (que ve el usuario mientras displayName/avatarId estan null)" → resuelto en S4: comportamiento identico a anonimo nuevo, rehidratacion en proximo auth state change, sin retry (out of scope explicito).
- IMPORTANTE: "Multi-tab / multi-device y billing no evaluados" → resuelto en S4: el fix no introduce writes competitivos nuevos, ni reads/listeners/triggers nuevos. `updateUserAvatar` ya existia.
- OBSERVACION: "Sin metrica de exito post-deploy observable" → resuelto: Success Criteria #2 define el `logger.error`→Sentry como senal observable de cuantas veces falla la lectura de perfil en el camino critico (antes se perdia con la app colgada).

### Observaciones abiertas para el implementador

- D1 (modelo de datos avatar-sin-displayName) debe resolverse con Gonzalo antes de implementar S2. S1 no esta bloqueado por D1 — puede ir primero.
- Coordinar el path de `updateUserAvatar` con #344 (offline guard de profile mutations) para no pisar el mismo callsite.


## Validacion Funcional (Gate Sofia)

**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-10
**Revisor:** Sofia (analista funcional)

**Observaciones clave (detalle completo incorporado a specs):** D1 (avatar sin displayName) abierta — S1 (loading) es independiente y puede ir primero. Aplicar avatarId .size()<=50 tambien al update. Coordinar con #344 (mismo callsite).
