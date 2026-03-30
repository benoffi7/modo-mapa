# Plan: Move avatar to AuthContext

**Specs:** [6-avatar-authcontext-specs.md](6-avatar-authcontext-specs.md)
**Fecha:** 2026-03-27

---

## Fases de implementacion

### Fase 1: Modelo de datos y converter

**Branch:** `feat/avatar-authcontext`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/types/index.ts` | Agregar `avatarId?: string \| undefined` a interfaz `UserProfile` |
| 2 | `src/config/converters.ts` | Modificar `userProfileConverter`: agregar `avatarId` en `toFirestore` y `fromFirestore` |
| 3 | `src/config/converters.test.ts` | Agregar 3 test cases para userProfileConverter con avatarId presente/ausente |

### Fase 2: AuthContext -- exponer avatarId

| Paso | Archivo | Cambio |
|------|---------|--------|
| 4 | `src/context/AuthContext.tsx` | Agregar `avatarId: string \| null` al state con `useState<string \| null>(null)` |
| 5 | `src/context/AuthContext.tsx` | Agregar `avatarId` y `setAvatarId` a la interfaz `AuthContextType` |
| 6 | `src/context/AuthContext.tsx` | En el default del context, agregar `avatarId: null` y `setAvatarId: async () => {}` |
| 7 | `src/context/AuthContext.tsx` | En `onAuthStateChanged` callback, al leer user doc: extraer `avatarId` con `setAvatarIdState(data.avatarId ?? null)` junto al `setDisplayNameState` existente |
| 8 | `src/context/AuthContext.tsx` | Agregar import de `getAvatarById` desde `../constants/avatars` |
| 9 | `src/context/AuthContext.tsx` | Crear `setAvatarId` como `useCallback`: validar user, validar ID con `getAvatarById`, guardar previo, optimistic set, `updateDoc(userRef, { avatarId })`, revert en catch |
| 10 | `src/context/AuthContext.tsx` | Agregar `avatarId` y `setAvatarId` al `useMemo` value object y al dependency array |

### Fase 3: ProfileScreen -- consumir del context

| Paso | Archivo | Cambio |
|------|---------|--------|
| 11 | `src/components/profile/ProfileScreen.tsx` | Agregar `avatarId, setAvatarId` al destructure de `useAuth()` |
| 12 | `src/components/profile/ProfileScreen.tsx` | Eliminar el state `selectedAvatarId` (`useState<string \| undefined>`) |
| 13 | `src/components/profile/ProfileScreen.tsx` | Eliminar el `useEffect` que hace `getDoc` para cargar avatar (lineas 66-72) |
| 14 | `src/components/profile/ProfileScreen.tsx` | Eliminar `handleAvatarSelect` -- reemplazar el `onSelect` del AvatarPicker: `onSelect={(a) => setAvatarId(a.id)}` |
| 15 | `src/components/profile/ProfileScreen.tsx` | Actualizar la linea `const avatar = getAvatarById(selectedAvatarId)` a `const avatar = getAvatarById(avatarId ?? undefined)` |
| 16 | `src/components/profile/ProfileScreen.tsx` | Actualizar `selectedId` del AvatarPicker: `selectedId={avatarId ?? undefined}` |
| 17 | `src/components/profile/ProfileScreen.tsx` | Eliminar imports innecesarios: `doc`, `updateDoc`, `getDoc` de `firebase/firestore`, `db` de `../../config/firebase`, `COLLECTIONS` de `../../config/collections`, `logger` (si ya no se usa en otro lugar del archivo) |

### Fase 4: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 18 | `src/context/AuthContext.test.tsx` | Agregar test: avatarId se carga del user doc cuando existe (mockGetDoc retorna `{ avatarId: 'cat' }`) |
| 19 | `src/context/AuthContext.test.tsx` | Agregar test: avatarId es null cuando user doc no tiene avatarId |
| 20 | `src/context/AuthContext.test.tsx` | Agregar test: avatarId es null cuando user doc no existe |
| 21 | `src/context/AuthContext.test.tsx` | Agregar mock de `../constants/avatars` con `getAvatarById` que retorna truthy para IDs validos |
| 22 | `src/context/AuthContext.test.tsx` | Agregar test: setAvatarId actualiza state y llama updateDoc |
| 23 | `src/context/AuthContext.test.tsx` | Agregar test: setAvatarId revierte si updateDoc falla |
| 24 | `src/context/AuthContext.test.tsx` | Agregar test: setAvatarId rechaza ID invalido |
| 25 | `src/context/AuthContext.test.tsx` | Agregar test: setAvatarId no hace nada si user es null |

### Fase 5: Lint, verificacion y commit

| Paso | Archivo | Cambio |
|------|---------|--------|
| 26 | -- | Ejecutar `npx eslint src/context/AuthContext.tsx src/components/profile/ProfileScreen.tsx src/types/index.ts src/config/converters.ts --fix` |
| 27 | -- | Ejecutar `npx tsc --noEmit` para verificar tipos |
| 28 | -- | Ejecutar `npx vitest run src/context/AuthContext.test.tsx src/config/converters.test.ts` para verificar tests |
| 29 | -- | Ejecutar `npm run test:run` para verificar que no se rompio nada |
| 30 | -- | Commit con mensaje descriptivo |

---

## Orden de implementacion

1. `src/types/index.ts` -- agregar campo a interfaz (Paso 1)
2. `src/config/converters.ts` -- actualizar converter para el nuevo campo (Paso 2)
3. `src/config/converters.test.ts` -- tests del converter (Paso 3)
4. `src/context/AuthContext.tsx` -- agregar state, setter, lectura en login (Pasos 4-10)
5. `src/components/profile/ProfileScreen.tsx` -- consumir del context, eliminar Firestore directo (Pasos 11-17)
6. `src/context/AuthContext.test.tsx` -- tests del nuevo comportamiento (Pasos 18-25)
7. Lint + types + tests (Pasos 26-29)
8. Commit (Paso 30)

## Riesgos

1. **Regresion en tests existentes de AuthContext:** El mock de `getDoc` en los tests existentes retorna `{ displayName: 'Juan' }` sin `avatarId`. Esto deberia resultar en `avatarId: null` (via `?? null`), lo cual es correcto. Riesgo bajo, pero verificar que los 35 tests existentes siguen pasando.

2. **Race condition en setter:** Si el usuario cambia avatar rapidamente, multiples `updateDoc` podrian ejecutarse en paralelo. Riesgo bajo porque Firestore resuelve con last-write-wins y el optimistic update local siempre refleja la ultima seleccion. No se necesita debounce porque el AvatarPicker cierra al seleccionar.

3. **User doc sin avatarId preexistente:** Usuarios que nunca seleccionaron avatar tendran docs sin el campo `avatarId`. El `?? null` en la lectura y `getAvatarById(undefined)` retornando `undefined` ya manejan este caso correctamente.

## Criterios de done

- [ ] ProfileScreen no hace getDoc al montar
- [ ] ProfileScreen no importa nada de `firebase/firestore` directamente
- [ ] Avatar se muestra inmediatamente desde el context (sin loading state)
- [ ] Avatar persiste en Firestore al cambiar via setAvatarId
- [ ] setAvatarId valida que el ID sea de un avatar existente
- [ ] setAvatarId revierte optimisticamente si updateDoc falla
- [ ] Otros componentes pueden acceder a avatarId via useAuth()
- [ ] userProfileConverter serializa/deserializa avatarId
- [ ] Tests pasan con >= 80% coverage en codigo nuevo
- [ ] No lint errors
- [ ] Build succeeds (`tsc --noEmit`)
- [ ] Los 35 tests existentes de AuthContext siguen pasando
