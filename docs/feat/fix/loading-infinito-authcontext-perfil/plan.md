# Plan de implementación: Loading infinito en AuthContext (#341)

> Basado en `specs.md` (VALIDADO CON OBSERVACIONES por Sofia, 2026-06-10; VALIDADO CON OBSERVACIONES por Diego, ver specs.md:522-538).
> **S1 (loading infinito) es independiente de S2 (avatar) y se mergea primero.** D1 fue RESUELTA por producto (Gonzalo) = camino (a) = SÍ: se permite user doc con `avatarId` sin `displayName` (specs.md:24-30). Camino (b) descartado.

## Estrategia y staging de riesgo

| Fase | Riesgo | Depende de | Mergeable solo |
|------|--------|-----------|----------------|
| F1 — Fix loading infinito (S1) | Bajo | — | ✅ Sí |
| F2 — `avatarId` size cap en rules (S2a) | Bajo | — | ✅ Sí |
| F3 — `updateUserAvatar` fallback setDoc + rule create solo-avatar (S2b) | Medio | F1/F2 | ✅ Sí, detrás de F1/F2 (D1 resuelta; depende de F2 por el cap de `avatarId`, no de una decisión abierta) |

## Fase 1 — Fix del loading infinito (S1) `[independiente, prioridad máxima]`

- **Archivo:** `src/context/AuthContext.tsx` (callback de `onAuthStateChanged`, ~líneas 96-124).
- **Cambio:** envolver `await fetchUserProfileDoc(uid)` en `try/catch`; mover `setIsLoading(false)` a un bloque `finally`. En el `catch`: `logger.error(...)` (→ Sentry) y degradar a sesión sin perfil (no quedar colgado).
- **Test:** `AuthContext.test.tsx` — nuevo caso: `fetchUserProfileDoc` rechaza (red/offline/regla) → `isLoading` termina en `false`, la app no queda en pantalla de carga; se emite `logger.error`.
- **Commit:** `fix(#341): reset isLoading en finally del onAuthStateChanged (evita loading infinito)`
- **Rollback:** revert del commit; sin migración ni cambio de datos.

## Fase 2 — Límite `avatarId .size() <= 50` en rules (S2a) `[independiente de D1]`

- **Archivo:** `firestore.rules` (bloque `users`, paths create y **update**).
- **Cambio:** agregar `request.resource.data.avatarId.size() <= 50` tanto en create como en update (hoy solo valida `is string`). Observación Sofia: aplicar también al update existente.
- **Test:** `tests/rules/users.rules.test.ts` — avatarId > 50 chars rechazado en create y update; <= 50 aceptado.
- **Commit:** `fix(#341): cap avatarId a 50 chars en users rules (create + update)`
- **Rollback:** revert del bloque de rules.

## Fase 3 — `updateUserAvatar` con fallback de creación + rule create solo-avatar (S2b) `[D1 resuelta = camino (a)]`

> D1 RESUELTA (specs.md:24-30): se permite user doc con `avatarId` sin `displayName`. Esta fase implementa el **camino (a)** confirmado. Depende de F1/F2 (cap de `avatarId`), no de una decisión abierta.

- **Cambio 1 — service (`src/services/userProfile.ts`, `updateUserAvatar`, ~158-161):** branch de existencia con paridad con `updateUserDisplayName` — `setDoc(ref, { avatarId, createdAt: serverTimestamp() })` si el doc no existe, `updateDoc(ref, { avatarId })` si existe (specs.md:240-256). El fallback `setDoc` no debe lanzar `not-found`.
- **Cambio 2 — rule de create solo-avatar (`firestore.rules`, bloque `users`, path create, reemplaza L28-45):** relajar la **obligatoriedad** de `displayName`/`displayNameLower` — **ambos ausentes (create solo-avatar) XOR ambos presentes-y-sincronizados** — manteniendo `hasOnly` (whitelist de 4 campos, sin agregar ninguno), ownership por doc ID, `createdAt` server-side, y la invariante #322 R12 (`displayNameLower == displayName.lower()`). Regla exacta en specs.md:117-160.
- **Coordinación con #344:** ver nota al final del plan ("Coordinación con #344"). Capas distintas, no colisionan; ambos PRs tocan archivos del mismo dominio — quien mergee segundo rebasa y NO revierte el fallback `setDoc` de #341.
- **Test:**
  - `userProfile.test.ts` — `updateUserAvatar` sobre doc **inexistente** → ejecuta `setDoc`, no lanza `not-found`; sobre doc **existente** → ejecuta `updateDoc`.
  - `users.rules.test.ts` — create solo-avatar (`{ avatarId, createdAt }`, ambos display ausentes) ACEPTADO; create con `displayNameLower` sin `displayName` DENEGADO; create con display sincronizado ACEPTADO.
- **Commit:** `fix(#341): updateUserAvatar fallback setDoc + rule create solo-avatar (camino a de D1)`
- **Rollback:** revert conjunto **service + rules** (un solo commit atómico para los dos cambios de la fase).

## Test plan global

- Unit: `AuthContext.test.tsx` (F1), `userProfile.test.ts` (F3 — branch existencia: inexistente→setDoc, existente→updateDoc).
- Rules: `users.rules.test.ts` (F2 — cap avatarId; F3 — create solo-avatar aceptado, `displayNameLower` solo denegado).
- Regresión: `npm run guards` verde; cobertura branches >= 80%.

## Rollback global

Cada fase es un commit atómico revertible. F1 y F2 no tocan datos. F3 toca service + rules en un solo commit — revert conjunto rules+servicio. Sin backfill ni migración de datos en ninguna fase.

## Coordinación con #344 (offline custom tags / profile mutations)

#341 y #344 tocan archivos del mismo dominio pero en **capas distintas que no colisionan**:

- **#344 Fase 5** (`docs/feat/infra/offline-custom-tags-profile-mutations/plan.md:101-111`) agrega un guard `navigator.onLine` early-return en `setAvatarId`/`setDisplayName` **dentro de `AuthContext`** (callsite / context layer).
- **#341 Fase 3** toca el **cuerpo de `updateUserAvatar`** (`src/services/userProfile.ts`, service layer): el branch de existencia con fallback `setDoc`.

Solapamiento de archivos: #341 toca `AuthContext.tsx` (F1) + `userProfile.ts` (F3); #344 toca `AuthContext.tsx` (F5).

**Regla para quien mergee segundo:** rebasar sobre el primero y **NO revertir** ni el fallback `setDoc` de #341 (en `userProfile.ts`) ni el guard `navigator.onLine` de #344 (en `AuthContext.tsx`). Son cambios complementarios en capas separadas. Dejar esta nota en el PR.

## Validacion de Plan

**Validador:** Pablo (Delivery Lead — Modo Mapa)
**Estado:** VALIDADO CON OBSERVACIONES
**Fecha:** 2026-06-12
**Ciclo:** 2

**Gates previos verificados:** PRD sellado por Sofia (VALIDADO CON OBSERVACIONES, prd.md:284-288). Specs sellado por Diego (VALIDADO CON OBSERVACIONES, specs.md:522-538). D1 RESUELTA por Gonzalo = camino (a) = SI (specs.md:24-30). El plan ahora refleja camino (a): Fase 3 reescrita (service `setDoc` branch + rule de create solo-avatar), camino (b) eliminado, tabla de staging actualizada (F3 ya no "bloqueada por D1").

**Cerrado en esta iteracion (Ciclo 2):**
- BLOQUEANTE Ciclo 1 "gates previos faltantes (Diego + D1)" → resuelto: ambos sellados.
- BLOQUEANTE "Fase 3 con camino indefinido (a|b)" → resuelto: el plan fija camino (a). Fase 3 = service (`updateUserAvatar` setDoc/updateDoc branch, specs.md:240-256) + rule create solo-avatar (specs.md:117-160) + tests de ambos. Commit message fija "camino a de D1".
- IMPORTANTE "rule de create solo-avatar no listada como cambio explicito de la fase" → resuelto: Cambio 2 de Fase 3 la lista; rollback conjunto service+rules.
- IMPORTANTE "coordinacion con #344 (mismo dominio AuthContext.tsx + updateUserAvatar)" → resuelto: seccion propia con separacion por capas (context guard `navigator.onLine` de #344 F5 vs service body de #341 F3) y regla explicita de no-revert para quien mergee segundo.

**Observaciones para el implementador:**

1. **Orden de merge entre #341 y #344 — no es paralelo limpio, hay solape en `AuthContext.tsx`.** #341 F1 toca el callback de `onAuthStateChanged` (try/finally) y #344 F5 toca los callbacks `setAvatarId`/`setDisplayName` del MISMO archivo. Son bloques distintos del archivo (lineas 96-124 vs 134-145), no colisionan logicamente, pero git puede pedir rebase si ambos editan cerca. Quien mergee segundo rebasa y NO revierte: ni el try/finally de #341 F1, ni el fallback `setDoc` de #341 F3 (en `userProfile.ts`), ni el guard `navigator.onLine` de #344 F5. La nota ya esta en ambos planes; mantenerla en los PRs.

2. **F1 mergea primero y solo — es el core del bug (loading infinito), bajo riesgo, sin tocar rules ni datos.** No esperar a F2/F3. Es el fix que la app necesita ya.

3. **F3 es un solo commit atomico con DOS archivos (service + rules).** El rollback es conjunto. Asignar la fase a UN solo owner (nico: rules + service + sus tests) para no fragmentar el commit atomico. El test de rules (`users.rules.test.ts`) y el de service (`userProfile.test.ts`) van EN la fase, no diferidos.

4. **Test plan integrado por fase, no al final.** F1 trae su test de AuthContext; F2 su test de cap avatarId; F3 sus tests de service+rules. Correcto — thanos no va a encontrar rules sin test.

5. **Pre-push hook (tsc + vite build) y blocker de 400 lineas:** ningun archivo de produccion supera 400 (specs.md:507-518, AuthContext ~272, userProfile ~169). Sin riesgo de gate de tamano. `firestore.rules` no cuenta para el limite de TS.

6. **Documentacion:** el PRD agenda (prd.md:176-180) posibles updates a `patterns.md` (nota auth/finally), `tests.md` (checkbox `users`), `firestore.md` (path create solo-avatar). El plan los referencia via specs pero NO los agenda como paso propio. No es bloqueante (el skill `/merge` corre el audit de docs y los exige ahi), pero conviene que el owner de F3 actualice `tests.md` (checkbox `users`) y `firestore.md` (nuevo path valido de create) en la misma fase para no chocar con el gate de docs del merge.

**Listo para pasar a implementacion:** Si, con observaciones. Sin bloqueantes. Delegar F1 primero (merge solo), luego F2, luego F3 (un owner, commit atomico service+rules+tests). Coordinar el solape de `AuthContext.tsx` con #344 (rebase, no-revert).
