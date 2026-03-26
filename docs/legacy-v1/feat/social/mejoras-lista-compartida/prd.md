# PRD: Mejoras en vista de lista compartida

**Feature:** mejoras-lista-compartida
**Categoria:** social
**Fecha:** 2026-03-18
**Issue:** [#160](https://github.com/benoffi7/modo-mapa/issues/160)
**Prioridad:** Alta

---

## Contexto

Las listas compartidas (v2.13.0, #142) permiten crear listas de comercios y compartirlas via deep link (`?list=<id>`). La implementación actual incluye: CRUD de listas (`sharedLists.ts`), items con IDs compuestos (`${listId}__${businessId}`), counter denormalizado `itemCount`, toggle público/privado, y componentes `SharedListsView` + `AddToListDialog`. No existen Cloud Functions para esta feature.

Sin embargo, la experiencia del receptor de un link es limitada: al tocar un comercio se abre el BusinessSheet y la lista desaparece, no hay forma de copiar la lista a las propias, ni de marcar favoritos en bloque.

## Problema

- Al tocar un comercio desde una lista compartida, el BusinessSheet se abre y la lista desaparece — hay que volver a usar el link.
- No se puede copiar una lista ajena a las propias listas del usuario.
- No se pueden marcar favoritos masivamente desde la vista de lista compartida.

## Solución

### S1: Persistir la lista compartida

- Guardar el `listId` en estado del `MapContext` para que al cerrar el BusinessSheet se vuelva a mostrar la lista.
- Al volver al menú lateral, la lista compartida sigue visible hasta que el usuario la cierre explícitamente.
- Usar el patrón existente de `selectedBusiness` en `MapContext` como referencia.

### S2: Botón "Copiar lista"

- Botón en el header de la vista de lista compartida (solo visible si no es el owner).
- Crea una copia de la lista en las listas del usuario: nuevo doc en `sharedLists` + copia de todos los `listItems`.
- Función nueva en `sharedLists.ts`: `copyList(sourceListId, targetUserId)`.
- Validar límite de 10 listas por usuario antes de copiar.
- Toast de éxito: "Lista copiada a Mis Listas".

### S3: Favoritos masivos

- Botón "Agregar todos a favoritos" en el header de la lista.
- Usa la función existente `addFavorite()` de `src/services/favorites.ts` en batch.
- Skip los que ya son favoritos (check previo con query de favoritos del usuario).
- Ícono de corazón por comercio individual para toggle de favorito inline (reusa `FavoriteButton` pattern).

### S4: Navegación de vuelta

- Al cerrar el BusinessSheet, si el usuario venía de una lista compartida, reabrir el SideMenu en la sección de listas con la lista compartida visible.
- Implementar via callback en `MapContext` o prop drilling desde `SharedListsView`.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Persistir listId en MapContext | Alta | S |
| Volver a lista al cerrar BusinessSheet | Alta | S |
| Botón copiar lista + service function | Alta | M |
| Favoritos masivos (batch) | Media | M |
| Favorito individual por comercio | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Notificar al creador de la lista cuando alguien la copia.
- Editar la lista copiada inline (se edita desde Mis Listas).
- Sincronización en tiempo real de cambios en la lista original.
- Compartir la copia (el usuario puede compartir su propia lista).

---

## Tests

### Archivos que necesitarán tests

| Archivo | Tipo | Qué testear |
|---------|------|-------------|
| `src/services/sharedLists.ts` | Service | `copyList` — validación límite 10 listas, copia de items, counter `itemCount` correcto |
| `src/services/favorites.ts` | Service | Batch add — skip duplicados, cache invalidation |

### Casos a cubrir

- `copyList` con lista de 0, 1, y N items
- `copyList` cuando el usuario ya tiene 10 listas (debe fallar)
- `copyList` preserva `name`, `description` pero cambia `ownerId`
- Favoritos masivos: skip de comercios ya favoritos
- Favoritos masivos: cache invalidation después del batch

### Mock strategy

- Firestore: mock `getDocs`, `addDoc`, `setDoc`, `getCountFromServer`
- Cache: mock `invalidateQueryCache`
- Analytics: mock `trackEvent`

### Criterio de aceptación

- Cobertura ≥ 80% del código nuevo (`copyList`, batch favorites)
- Todos los paths de validación cubiertos

---

## Seguridad

- [ ] `copyList` valida que la lista source sea pública (`isPublic === true`) o que el caller sea el owner
- [ ] La copia genera un nuevo `ownerId` = caller, no hereda el original
- [ ] Límite de 10 listas enforced tanto en client como en rules (ya existe en `create`)
- [ ] Batch de favoritos respeta rate limits existentes del servicio `favorites.ts`
- [ ] No se expone el `ownerId` de la lista original al copiar

---

## Success Criteria

1. Al abrir un comercio desde una lista compartida y cerrar el BusinessSheet, la lista sigue visible.
2. El botón "Copiar lista" crea una copia funcional en Mis Listas con todos los items.
3. "Agregar todos a favoritos" marca todos los comercios como favoritos en una operación.
4. Cada comercio en la lista tiene un ícono de favorito para toggle individual.
5. Los tests del código nuevo pasan con ≥80% de cobertura.
