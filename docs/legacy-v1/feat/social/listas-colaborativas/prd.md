# PRD: Listas colaborativas — múltiples editores por lista

**Feature:** listas-colaborativas
**Categoria:** social
**Fecha:** 2026-03-18
**Issue:** [#155](https://github.com/benoffi7/modo-mapa/issues/155)
**Prioridad:** Media

---

## Contexto

Las listas compartidas (v2.13.0) permiten compartir via deep link pero solo el creador puede editar. La implementación actual usa `ownerId` para control de acceso en Firestore rules, con validación de ownership en create/update/delete. Los items usan IDs compuestos `${listId}__${businessId}` y la colección `listItems` permite create/delete a cualquier usuario autenticado (sin validación de ownership del item).

El proyecto usa `assertAdmin` para callable functions y tiene el patrón de `editorIds` array en rules (similar a `userTags` pero no idéntico). No existe búsqueda de usuarios por email/nombre en el frontend — solo se resuelven displayNames via `users/{uid}` docs.

## Problema

- Solo el creador de la lista puede agregar o quitar comercios.
- No hay forma de invitar a otros usuarios como editores.
- Las listas compartidas son read-only para los receptores.

## Solución

### S1: Modelo de datos — campo `editorIds`

- Agregar campo `editorIds: string[]` al tipo `SharedList` (default `[]`).
- Máximo 5 editores por lista (constante en `constants/lists.ts`).
- Converter actualizado para manejar el array.

### S2: Firestore rules para editores

- `sharedLists` read: owner OR editor OR `isPublic == true` OR `featured == true`.
- `sharedLists` update: owner puede todo; editor solo puede modificar items (no name/description/isPublic/editorIds).
- `listItems` create/delete: owner OR userId en `editorIds` del parent list.
- Validación: `request.auth.uid in get(/databases/$(database)/documents/sharedLists/$(listId)).data.editorIds`.

### S3: Invitar editores

- Nuevo callable function `inviteListEditor(listId, targetEmail)`:
  - Busca usuario por email en `users` collection.
  - Valida que el caller sea owner.
  - Valida límite de 5 editores.
  - Agrega userId al array `editorIds` vía `FieldValue.arrayUnion`.
- Callable `removeListEditor(listId, targetUserId)`:
  - Solo owner puede remover editores.
  - Usa `FieldValue.arrayRemove`.

### S4: UI — Gestión de editores

- Botón "Invitar" en el header de la lista (solo visible para owner).
- Dialog con input de email + botón buscar.
- Lista de editores actuales con botón remover.
- Badge "Colaborativa" en listas con `editorIds.length > 0`.
- Indicador de quién agregó cada comercio (campo `addedBy` en `listItems`).

### S5: UI — Vista de editor

- El editor ve la lista en modo editable (puede agregar/quitar comercios).
- Sección "Listas compartidas conmigo" en `SharedListsView` (query: `editorIds array-contains userId`).
- No puede: eliminar la lista, cambiar nombre/descripción, toggle público, invitar editores.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Campo `editorIds` en tipo + converter | Alta | XS |
| Firestore rules para editores | Alta | M |
| Callable `inviteListEditor` | Alta | M |
| Callable `removeListEditor` | Alta | S |
| UI gestión de editores (owner) | Alta | M |
| Sección "Compartidas conmigo" | Media | S |
| Badge colaborativa + indicador `addedBy` | Baja | S |

**Esfuerzo total estimado:** L

---

## Out of Scope

- Roles adicionales (viewer, moderator).
- Notificaciones cuando un editor agrega un comercio (puede agregarse después con el sistema de notificaciones existente).
- Historial de cambios en la lista.
- Chat o comentarios dentro de la lista.
- Invitar por link (solo por email).

---

## Tests

### Archivos que necesitarán tests

| Archivo | Tipo | Qué testear |
|---------|------|-------------|
| `functions/src/callable/inviteListEditor.ts` | Callable | Validación owner, email lookup, límite 5 editores, arrayUnion |
| `functions/src/callable/removeListEditor.ts` | Callable | Validación owner, self-remove prevention, arrayRemove |
| `src/services/sharedLists.ts` | Service | `fetchSharedWithMe` — query `array-contains`, converter |

### Casos a cubrir

- `inviteListEditor` rechaza non-owner
- `inviteListEditor` rechaza email no existente
- `inviteListEditor` rechaza cuando ya hay 5 editores
- `inviteListEditor` rechaza invitar al owner
- `inviteListEditor` rechaza invitar editor duplicado
- `removeListEditor` rechaza non-owner
- `removeListEditor` funciona con userId válido
- Firestore rules: editor puede crear/borrar items pero no modificar la lista
- Firestore rules: non-editor no puede crear items en lista privada
- Query `array-contains` retorna solo listas donde el user es editor

### Mock strategy

- Functions: mock `getFirestore`, `assertAdmin` (para owner check, no admin), `FieldValue.arrayUnion/arrayRemove`
- Users lookup: mock `where('email', '==', targetEmail)` query
- Frontend: mock Firestore queries

### Criterio de aceptación

- Cobertura ≥ 80% de ambas callable functions
- Firestore rules testeadas (al menos conceptualmente en specs)
- Todos los paths de validación cubiertos

---

## Seguridad

- [ ] Solo el owner puede invitar/remover editores — validar en callable function
- [ ] Búsqueda de usuario por email no filtra información (no revelar si el email existe a non-owners)
- [ ] Límite de 5 editores enforced tanto en callable como en Firestore rules (`editorIds.size() <= 5`)
- [ ] Firestore rules: editor no puede modificar `editorIds`, `ownerId`, `name`, `description`, `isPublic`
- [ ] `listItems` create/delete por editor requiere `get()` del parent list para validar `editorIds` — costoso pero necesario
- [ ] Campo `addedBy` en items es `request.auth.uid`, no un valor del cliente
- [ ] Owner no puede invitarse a sí mismo como editor
- [ ] Editor no puede escalar a owner ni invitar otros editores

---

## Success Criteria

1. El creador puede invitar editores por email (máximo 5).
2. Los editores pueden agregar y quitar comercios de la lista.
3. Los editores no pueden eliminar la lista, cambiar nombre/descripción, ni invitar editores.
4. Las Firestore rules validan permisos de owner y editor correctamente.
5. La UI muestra claramente que la lista es colaborativa y quiénes son los editores.
6. La sección "Compartidas conmigo" muestra las listas donde el usuario es editor.
7. Tests del código nuevo pasan con ≥80% de cobertura.
