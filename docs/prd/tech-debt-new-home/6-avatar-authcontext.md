# PRD: Move avatar to AuthContext

**Issue:** #206 item 6
**Priority:** Low
**Effort:** Small (1-2h)

## Problema

`ProfileScreen` hace `getDoc(users/{uid})` en cada mount solo para leer `avatarId`. El user doc ya se lee en `AuthContext` al login, pero `avatarId` no se extrae ahi. Esto causa un read extra de Firestore en cada visita al perfil.

## Archivos afectados

- `src/context/AuthContext.tsx`
- `src/components/profile/ProfileScreen.tsx`

## Solucion propuesta

1. En `AuthContext`, al leer el user doc (linea ~94), extraer `avatarId` junto con `displayName`
2. Exponer `avatarId` y `setAvatarId` desde el context
3. `ProfileScreen` consume `avatarId` del context en vez de hacer getDoc
4. `handleAvatarSelect` usa `setAvatarId` del context (que internamente hace updateDoc)

## Criterios de aceptacion

- [ ] ProfileScreen no hace getDoc al montar
- [ ] Avatar se muestra inmediatamente desde el context
- [ ] Avatar persiste en Firestore al cambiar
- [ ] Otros componentes pueden acceder al avatar si lo necesitan
