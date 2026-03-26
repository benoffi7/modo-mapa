# Plan: Check-in — Fui acá

**Feature:** check-in
**Fecha:** 2026-03-20
**Specs:** [specs.md](specs.md)
**Dependencias:** ninguna (feature standalone en v2.24)

---

## Step 1: Data Model — Tipos, constantes, converter

**Archivos a crear/modificar:**

- `src/types/index.ts` — agregar interface `CheckIn`
- `src/constants/checkin.ts` — crear con `CHECKIN_PROXIMITY_RADIUS_M`, `CHECKIN_COOLDOWN_HOURS`, `MAX_CHECKINS_PER_DAY`
- `src/config/converters.ts` — agregar `checkinConverter`

**Por que primero:** todo lo demas depende del tipo y las constantes.

**Criterio de completado:** tipos compilan sin errores, constantes exportadas.

---

## Step 2: Firestore Rules + Rate Limit

**Archivos a modificar:**

- `firestore.rules` — agregar reglas para `checkins/{docId}` y rate limit en `_rateLimits`

**Detalle:**

- create: auth + userId match + campos requeridos
- read: solo docs propios
- update/delete: bloqueados
- Rate limit: max 10/dia usando `_rateLimits` collection

**Criterio de completado:** reglas desplegadas en emulador, tests de rules pasan.

---

## Step 3: Service Layer

**Archivos a crear:**

- `src/services/checkins.ts` — `createCheckIn`, `fetchMyCheckIns`, `fetchCheckInsForBusiness`

**Patron:** seguir estructura de services existentes (ej: `comments.ts`, `ratings.ts`). Usar `checkinConverter` para queries tipadas.

**Criterio de completado:** funciones exportadas, tests unitarios pasan.

---

## Step 4: Cloud Function Trigger + Tests

**Archivos a crear:**

- `functions/src/triggers/checkins.ts` — `onCheckInCreated`
- `functions/src/triggers/checkins.test.ts` — tests del trigger

**Detalle:** incrementar rate limit counter en `_rateLimits/{userId}/checkins/{date}`.

**Patron:** seguir estructura de triggers existentes. Usar `getDb(databaseId)` y respetar `ENFORCE_APP_CHECK`.

**Criterio de completado:** trigger se ejecuta en emulador, test pasa con >= 80% coverage.

---

## Step 5: Hooks

**Archivos a crear:**

- `src/hooks/useCheckIn.ts` — estado de check-in para un comercio
- `src/hooks/useMyCheckIns.ts` — historial de check-ins del usuario
- `src/hooks/useCheckIn.test.ts` — tests
- `src/hooks/useMyCheckIns.test.ts` — tests

**Dependencias:** Step 3 (service layer).

**Criterio de completado:** hooks funcionan, tests pasan con >= 80% coverage.

---

## Step 6: UI — CheckInButton en BusinessSheet

**Archivos a crear/modificar:**

- `src/components/business/CheckInButton.tsx` — crear componente
- `src/components/business/CheckInButton.test.tsx` — tests
- `src/components/business/BusinessSheet.tsx` — agregar CheckInButton debajo de BusinessHeader

**Detalle:**

- Botón "Fui aca" con estados: ready, loading, success, cooldown.
- Proximity warning via snackbar (soft, no bloquea).
- Si no hay auth, mostrar prompt de login.

**Criterio de completado:** boton visible en BusinessSheet, estados funcionan, tests pasan.

---

## Step 7: UI — CheckInsView en SideMenu

**Archivos a crear/modificar:**

- `src/components/menu/CheckInsView.tsx` — crear componente
- `src/components/menu/CheckInsView.test.tsx` — tests
- SideMenu — agregar entrada "Mis visitas" con lazy loading

**Detalle:**

- Header con stats (total visitas, comercios unicos).
- Lista cronologica con fecha relativa.
- Click navega a comercio.
- Estado vacio con mensaje.
- Pull-to-refresh.

**Criterio de completado:** seccion visible en SideMenu, navegacion funciona, tests pasan.

---

## Step 8: Analytics Events

**Archivos a modificar:**

- `CheckInButton.tsx` — emitir `checkin_created`, `checkin_proximity_warning`, `checkin_cooldown_blocked`
- `CheckInsView.tsx` — emitir `checkins_viewed`

**Patron:** seguir implementacion existente de analytics en el proyecto.

**Criterio de completado:** eventos se disparan correctamente en emulador.

---

## Step 9: Tests — Firestore Rules

**Archivos a crear:**

- `functions/src/rules/checkins.rules.test.ts` — tests de integracion para reglas

**Scenarios:**

- create con auth valido -> OK
- create sin auth -> DENIED
- create con userId distinto -> DENIED
- read docs propios -> OK
- read docs ajenos -> DENIED
- update -> DENIED
- delete -> DENIED
- rate limit: check-in 11 -> DENIED

**Criterio de completado:** todos los scenarios pasan, >= 80% coverage.

---

## Step 10: Verification Checklist

Antes de abrir PR:

- [ ] `npm run lint` sin errores
- [ ] `npm run typecheck` sin errores
- [ ] `npm run test` todos pasan
- [ ] Coverage >= 80% en archivos nuevos
- [ ] Emulador: check-in se crea, se lee, se bloquea update/delete
- [ ] Emulador: rate limit funciona (11vo check-in falla)
- [ ] Emulador: Cloud Function trigger se ejecuta
- [ ] UI: boton "Fui aca" aparece y funciona en BusinessSheet
- [ ] UI: "Mis visitas" aparece en SideMenu con datos
- [ ] UI: navegacion de check-in a comercio funciona
- [ ] UI: estado vacio muestra mensaje correcto
- [ ] Privacy policy actualizada si se recolecta ubicacion
- [ ] `changelog.md` actualizado con archivos creados/modificados
