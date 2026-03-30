# PRD: Architecture: extraer writes de AuthContext y Firebase imports de componentes

**Feature:** 243-service-layer-violations
**Categoria:** infra
**Fecha:** 2026-03-29
**Issue:** #243
**Prioridad:** Media

---

## Contexto

El proyecto tiene una politica estricta de service layer: componentes y contexts no deben importar directamente de `firebase/firestore`, `firebase/storage` o `firebase/functions`. Las operaciones CRUD van en `src/services/`, y solo `services/`, `config/`, `context/` y `hooks/` pueden importar del SDK de Firebase. Una auditoria detecto tres violaciones activas: AuthContext hace writes directos a Firestore para user profile, MenuPhotoViewer importa `httpsCallable` de `firebase/functions`, y MenuPhotoSection importa `ref`/`getDownloadURL` de `firebase/storage`.

## Problema

- **VC-1: AuthContext hace writes directos a Firestore** — `setDoc`/`updateDoc`/`getDoc` en AuthContext.tsx para operaciones de user profile (crear perfil, actualizar displayName, actualizar avatar). Esto acopla el contexto de autenticacion con Firestore SDK y dificulta testing.
- **VC-2: MenuPhotoViewer importa firebase/functions** — Componente user-facing importa `httpsCallable` directamente para reportar fotos. Viola la boundary del service layer.
- **VC-3: MenuPhotoSection importa firebase/storage** — Componente importa `ref`/`getDownloadURL` de `firebase/storage` directamente para obtener URLs de fotos. Viola la boundary del service layer.

## Solucion

### S1. Extraer operaciones de user profile a `services/userProfile.ts`

Crear funciones `createUserProfile(uid, displayName)`, `updateUserDisplayName(uid, name)` y `updateUserAvatar(uid, avatarId)` en `services/userProfile.ts`. Este servicio ya existe parcialmente (tiene `fetchUserProfile` y `fetchPublicProfiles`). Se extiende con las operaciones de escritura. AuthContext pasa a consumir el servicio en vez de hacer writes directos.

Referencia de patron: todos los otros servicios (`ratings.ts`, `comments.ts`, `favorites.ts`, etc.) ya siguen este patron. Se alinea AuthContext con la convencion existente.

### S2. Mover `reportMenuPhoto` a `services/menuPhotos.ts`

Crear funcion `reportMenuPhoto(photoId)` en `services/menuPhotos.ts` que wrappee la llamada a `httpsCallable`. El servicio ya existe (tiene `fetchMenuPhotos`, `uploadMenuPhoto`). Se extiende con la operacion de reporte. MenuPhotoViewer pasa a importar del servicio.

### S3. Mover `getMenuPhotoUrl` a `services/menuPhotos.ts`

Crear funcion `getMenuPhotoUrl(path)` en `services/menuPhotos.ts` que wrappee `ref` + `getDownloadURL`. MenuPhotoSection pasa a importar del servicio.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Crear `createUserProfile`, `updateUserDisplayName`, `updateUserAvatar` en `services/userProfile.ts` | Must | S |
| Refactorear AuthContext para usar `services/userProfile.ts` | Must | S |
| Crear `reportMenuPhoto` en `services/menuPhotos.ts` | Must | S |
| Crear `getMenuPhotoUrl` en `services/menuPhotos.ts` | Must | S |
| Refactorear MenuPhotoViewer y MenuPhotoSection para usar servicios | Must | S |
| Tests para nuevas funciones de servicio | Must | S |
| Verificar que no quedan imports de firebase/ en components/ | Should | S |

**Esfuerzo total estimado:** S

---

## Out of Scope

- Refactorear AuthContext completamente (solo se extraen los writes a Firestore, no la logica de auth)
- Crear un servicio separado para Storage generico (solo se mueve la operacion especifica de menuPhotos)
- Cambiar la interfaz publica de AuthContext (los consumidores siguen usando las mismas funciones)
- Split de AuthContext en AuthStateContext + AuthActionsContext (eso es #245)

---

## Tests

### Archivos que necesitaran tests

| Archivo | Tipo | Que testear |
|---------|------|-------------|
| `src/services/userProfile.ts` | Unit | createUserProfile, updateUserDisplayName, updateUserAvatar — validacion, Firestore calls, error handling |
| `src/services/menuPhotos.ts` | Unit | reportMenuPhoto — callable invocation, error handling |
| `src/services/menuPhotos.ts` | Unit | getMenuPhotoUrl — ref creation, URL resolution, error handling |

### Criterios de testing

- Cobertura >= 80% del codigo nuevo
- Tests de validacion para todos los inputs del usuario
- Todos los paths condicionales cubiertos
- Side effects verificados (Firestore writes, callable invocations)

---

## Seguridad

- [ ] Las funciones de servicio preservan exactamente la misma logica de validacion que existia inline
- [ ] `updateUserDisplayName` valida longitud <= 30 chars (como lo hace AuthContext actualmente)
- [ ] `reportMenuPhoto` preserva la logica de prevencion de duplicados (doc ID = userId)
- [ ] No se introducen nuevos surface areas — es un refactor puro

### Vectores de ataque automatizado

| Superficie | Ataque posible | Mitigacion requerida |
|-----------|---------------|---------------------|
| N/A | N/A — refactor puro sin nuevas superficies | Preservar validaciones existentes |

---

## Deuda tecnica y seguridad

### Issues relacionados

| Issue | Relacion | Accion |
|-------|----------|--------|
| #245 Split AuthContext | Relacionado | #243 limpia los writes de AuthContext; #245 splitea el contexto por performance. #243 primero facilita #245 |
| Patron: service layer | Alinea | Este fix elimina las ultimas 3 violaciones del service layer |

### Mitigacion incorporada

- Se eliminan las ultimas violaciones conocidas del service layer
- Se mejora testability de AuthContext (los writes mockeables a nivel de servicio)
- Se reduce el acoplamiento de componentes con Firebase SDK

---

## Offline

### Data flows

| Operacion | Tipo (read/write) | Estrategia offline | Fallback UI |
|-----------|-------------------|-------------------|-------------|
| createUserProfile | write | Firestore persistent cache | N/A (ocurre en auth flow) |
| updateUserDisplayName | write | Firestore persistent cache | Optimistic UI en AuthContext |
| updateUserAvatar | write | Firestore persistent cache | Optimistic UI en AuthContext |
| reportMenuPhoto | write (callable) | Sin soporte offline (callable) | Toast de error si offline |
| getMenuPhotoUrl | read (Storage) | Sin cache (URL directa) | Placeholder de imagen |

### Checklist offline

- [x] Reads de Firestore: no cambia comportamiento existente
- [x] Writes: los writes a Firestore ya usan persistent cache; el refactor no cambia esto
- [x] APIs externas: callable `reportMenuPhoto` no tiene soporte offline (sin cambio)
- [x] UI: no hay cambios en UX offline
- [x] Datos criticos: no aplica

### Esfuerzo offline adicional: N/A

---

## Modularizacion y % monolitico

Este feature reduce el acoplamiento moviendo logica de Firebase SDK de componentes/contexts a servicios.

### Checklist modularizacion

- [x] Logica de negocio en hooks/services (se mueve de context a services)
- [x] Componentes nuevos son reutilizables (N/A - no hay componentes nuevos)
- [x] No se agregan useState de logica de negocio a AppShell o SideMenu
- [x] Props explicitas en vez de dependencias implicitas
- [x] Cada prop de accion tiene un handler real especificado
- [x] Ningun componente nuevo importa directamente de `firebase/firestore` (se eliminan imports existentes)
- [x] Archivos nuevos van en carpeta de dominio correcta (extensiones a servicios existentes)
- [x] Si el feature necesita estado global: N/A
- [x] Ningun archivo nuevo supera 400 lineas

### Impacto en % monolitico

| Aspecto | Impacto | Justificacion |
|---------|---------|---------------|
| Acoplamiento de componentes | - | Se eliminan imports directos de Firebase SDK en 3 archivos |
| Estado global | = | AuthContext mantiene su interfaz |
| Firebase coupling | - | Firebase SDK imports movidos de components/ a services/ |
| Organizacion por dominio | + | Operaciones de user profile centralizadas en un servicio |

---

## Success Criteria

1. AuthContext no importa directamente de `firebase/firestore` — usa `services/userProfile.ts`
2. MenuPhotoViewer no importa de `firebase/functions` — usa `services/menuPhotos.ts`
3. MenuPhotoSection no importa de `firebase/storage` — usa `services/menuPhotos.ts`
4. `grep -r "from 'firebase/" src/components/` no devuelve resultados (cero imports de Firebase SDK en componentes)
5. Todos los tests existentes pasan sin regresion
6. Tests nuevos para las funciones de servicio con >= 80% cobertura
