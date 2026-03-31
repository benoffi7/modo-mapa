# Plan: Extraer writes de AuthContext y Firebase imports de componentes

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Extraer operaciones de user profile a servicios

**Branch:** `feat/243-service-layer-violations`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/userProfile.ts` | Agregar imports de `doc`, `getDoc`, `setDoc`, `updateDoc`, `serverTimestamp` desde `firebase/firestore`. Agregar import de `userProfileConverter` desde `config/converters`. |
| 2 | `src/services/userProfile.ts` | Crear `fetchUserProfileDoc(uid: string): Promise<UserProfile \| null>` — `getDoc` con `userProfileConverter`, retorna data si existe, null si no. |
| 3 | `src/services/userProfile.ts` | Crear `updateUserDisplayName(uid: string, name: string): Promise<void>` — check con `getDoc` si doc existe: si existe `updateDoc({ displayName, displayNameLower })`, si no `setDoc({ displayName, displayNameLower, createdAt: serverTimestamp() })`. |
| 4 | `src/services/userProfile.ts` | Crear `updateUserAvatar(uid: string, avatarId: string): Promise<void>` — `updateDoc` con `{ avatarId }`. |
| 5 | `src/context/AuthContext.tsx` | Agregar imports: `fetchUserProfileDoc`, `updateUserDisplayName`, `updateUserAvatar` desde `../services/userProfile`. |
| 6 | `src/context/AuthContext.tsx` | Eliminar imports de `firebase/firestore`: `doc`, `getDoc`, `setDoc`, `updateDoc`, `serverTimestamp`. Eliminar import de `db` desde `config/firebase`. Eliminar import de `COLLECTIONS` desde `config/collections`. Eliminar import de `userProfileConverter` desde `config/converters`. |
| 7 | `src/context/AuthContext.tsx` | En `onAuthStateChanged` callback: reemplazar `getDoc(doc(db, COLLECTIONS.USERS, firebaseUser.uid).withConverter(userProfileConverter))` por `fetchUserProfileDoc(firebaseUser.uid)`. Adaptar check: `if (profile) { setDisplayNameState(profile.displayName \|\| null); setAvatarIdState(profile.avatarId ?? null); }`. |
| 8 | `src/context/AuthContext.tsx` | En `setDisplayName` callback: reemplazar toda la logica de `getDoc`/`updateDoc`/`setDoc` por `await updateUserDisplayName(user.uid, trimmed)`. Mantener validacion de trim/slice y el `setDisplayNameState(trimmed)` posterior. |
| 9 | `src/context/AuthContext.tsx` | En `setAvatarId` callback: reemplazar `updateDoc(doc(db, ...))` por `await updateUserAvatar(user.uid, id)`. Mantener optimistic update y revert on error. |
| 10 | `src/services/__tests__/userProfile.test.ts` | Crear test file con mocks de firebase/firestore. Tests: `fetchUserProfileDoc` (existe/no existe), `updateUserDisplayName` (existe/no existe), `updateUserAvatar` (call correcto), propagacion de errores. |

### Fase 2: Extraer Firebase imports de componentes de fotos

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/menuPhotos.ts` | Agregar import de `httpsCallable` desde `firebase/functions`. Agregar import de `functions` desde `config/firebase`. Agregar import de `getDownloadURL` desde `firebase/storage` (ya tiene `ref`). |
| 2 | `src/services/menuPhotos.ts` | Crear `reportMenuPhoto(photoId: string): Promise<void>` — `const report = httpsCallable(functions, 'reportMenuPhoto'); await report({ photoId });`. |
| 3 | `src/services/menuPhotos.ts` | Crear `getMenuPhotoUrl(path: string): Promise<string>` — `return getDownloadURL(ref(storage, path));`. |
| 4 | `src/components/business/MenuPhotoViewer.tsx` | Eliminar import de `httpsCallable` desde `firebase/functions`. Eliminar import de `functions` desde `config/firebase`. Agregar import de `reportMenuPhoto` desde `../../services/menuPhotos`. En `handleReport`: reemplazar `httpsCallable(functions, 'reportMenuPhoto')({ photoId })` por `await reportMenuPhoto(photoId)`. |
| 5 | `src/components/business/MenuPhotoSection.tsx` | Eliminar import de `ref`, `getDownloadURL` desde `firebase/storage`. Eliminar import de `storage` desde `config/firebase`. Agregar import de `getMenuPhotoUrl` desde `../../services/menuPhotos`. En useEffect: reemplazar `getDownloadURL(ref(storage, path))` por `getMenuPhotoUrl(path)`. |
| 6 | `src/services/__tests__/menuPhotos.test.ts` | Crear test file con mocks de firebase/functions y firebase/storage. Tests: `reportMenuPhoto` (call correcto, error), `getMenuPhotoUrl` (URL correcta, error). |

### Fase 3: Verificacion y cleanup

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `grep -r "from 'firebase/" src/components/` para verificar cero imports de Firebase SDK en componentes. |
| 2 | N/A | Ejecutar `grep -r "from 'firebase/firestore'" src/context/AuthContext.tsx` para verificar cero imports de firestore en AuthContext. |
| 3 | N/A | Ejecutar `npm run test:run` para verificar que todos los tests pasan. |
| 4 | N/A | Ejecutar `npm run lint` para verificar cero errores de lint. |
| 5 | N/A | Ejecutar `npm run build` para verificar que el build compila. |

### Fase 4: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Actualizar entrada "Service layer" para indicar que AuthContext ya no importa de firebase/firestore (solo usa servicios). Actualizar entrada "Email auth service layer" o agregar nota de que user profile writes ahora tambien estan en service layer. |
| 2 | `docs/reference/tests.md` | Actualizar inventario: marcar `userProfile.ts` con tests parciales (funciones nuevas), agregar `menuPhotos.test.ts` con tests parciales. |

---

## Orden de implementacion

1. `src/services/userProfile.ts` — agregar funciones de escritura (Fase 1, pasos 1-4)
2. `src/context/AuthContext.tsx` — refactorear para usar servicios (Fase 1, pasos 5-9)
3. `src/services/__tests__/userProfile.test.ts` — tests (Fase 1, paso 10)
4. `src/services/menuPhotos.ts` — agregar funciones (Fase 2, pasos 1-3)
5. `src/components/business/MenuPhotoViewer.tsx` — refactorear (Fase 2, paso 4)
6. `src/components/business/MenuPhotoSection.tsx` — refactorear (Fase 2, paso 5)
7. `src/services/__tests__/menuPhotos.test.ts` — tests (Fase 2, paso 6)
8. Verificacion (Fase 3)
9. Documentacion (Fase 4)

## Riesgos

1. **Tests existentes de AuthContext rompen.** El test file `AuthContext.test.tsx` tiene 35 cases que mockean `firebase/firestore` directamente. Al mover los writes a servicios, los mocks de firestore en ese test se simplifican (ya no se testean ahi), pero hay que verificar que los mocks de los servicios nuevos esten correctos. Mitigacion: mockear `services/userProfile` en los tests de AuthContext.

2. **`menuPhotos.ts` ya importa `ref` y `uploadBytesResumable` de `firebase/storage`.** Al agregar `getDownloadURL`, hay que verificar que el import existente no entre en conflicto. Mitigacion: agregar `getDownloadURL` al import existente de `firebase/storage`.

3. **Regresion en flujo de onboarding.** `setDisplayName` en AuthContext es critico para el flujo de primer nombre. Mitigacion: el test de AuthContext cubre este flujo; ademas, la logica de validacion no se mueve.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (extensiones a servicios existentes en `src/services/`)
- [x] Logica de negocio en hooks/services, no en componentes
- [x] Si se toca un archivo con deuda tecnica, se incluye el fix en el plan (userProfile.ts y menuPhotos.ts sin tests -> se agregan)
- [x] Ningun archivo resultante supera 400 lineas

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/patterns.md` | Agregar nota en "Service layer": AuthContext usa `services/userProfile.ts` para writes. |
| 2 | `docs/reference/tests.md` | Actualizar inventario de tests para `userProfile.ts` y `menuPhotos.ts`. |

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] `grep -r "from 'firebase/" src/components/` retorna cero resultados
- [ ] `grep -r "from 'firebase/firestore'" src/context/AuthContext.tsx` retorna cero resultados
- [ ] Reference docs updated (patterns.md, tests.md)
