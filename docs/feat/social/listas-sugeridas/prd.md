# PRD: Listas sugeridas por la plataforma

**Feature:** listas-sugeridas
**Categoria:** social
**Fecha:** 2026-03-18
**Issue:** [#156](https://github.com/benoffi7/modo-mapa/issues/156)
**Prioridad:** Media

---

## Contexto

Las listas compartidas (v2.13.0) son creadas por usuarios y solo visibles via deep link. No existen listas curadas ni generadas por la plataforma. El proyecto ya tiene la infraestructura de rankings (scheduled functions para `computeWeeklyRanking`, `computeMonthlyRanking`), aggregates pre-computados en `config/aggregates` (`businessFavorites`, `businessComments`, `businessRatingCount/Sum`, `ratingDistribution`), y el patrón de admin callable functions con `assertAdmin`.

La colección `sharedLists` actual tiene: `ownerId`, `name`, `description`, `isPublic`, `itemCount`, `createdAt`, `updatedAt`. Los items usan IDs compuestos `${listId}__${businessId}`.

## Problema

- Los usuarios nuevos no tienen listas para explorar.
- No hay contenido curado que facilite el descubrimiento de comercios.
- Las listas de otros usuarios no son visibles a menos que compartan el link.

## Solución

### S1: Campo `featured` en listas

- Agregar campo opcional `featured?: boolean` al tipo `SharedList`.
- Las listas con `featured: true` son visibles para todos los usuarios autenticados.
- Firestore rules: permitir read de listas con `featured == true` (adicional al owner y `isPublic`).
- Converter actualizado para manejar el campo.

### S2: Admin toggle para marcar lista como sugerida

- Nuevo botón en el admin panel (tab existente o sección en overview) para marcar/desmarcar listas como sugeridas.
- Callable function `toggleFeaturedList(listId, featured)` con `assertAdmin`.
- Solo listas públicas pueden ser marcadas como featured.

### S3: Listas generadas automáticamente

- Cloud Function scheduled (semanal, lunes 5am ART como los rankings):
  - "Top 10 más calificados" — usa `config/aggregates.businessRatingCount` + `businessRatingSum` para calcular promedios, top 10.
  - "Más comentados" — usa `config/aggregates.businessComments`, top 10.
  - "Favoritos de la comunidad" — usa `config/aggregates.businessFavorites`, top 10.
- La función crea/actualiza docs en `sharedLists` con un `ownerId` especial (`system`) y `featured: true`.
- Items actualizados en cada ejecución (delete old + create new).

### S4: UI en sección de listas

- Sección "Destacadas" arriba de "Mis Listas" en `SharedListsView`.
- Cards horizontales scrolleables con nombre, descripción corta y cantidad de comercios.
- Badge "Destacada" para distinguir de listas de usuario.
- Click abre la lista en formato read-only (mismo componente que lista compartida).
- Botón copiar disponible (reusa S2 de #160 si implementado).

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Campo `featured` en tipo + converter + rules | Alta | XS |
| Callable `toggleFeaturedList` + admin UI | Alta | S |
| Cloud Function scheduled para listas automáticas | Media | M |
| Sección "Destacadas" en UI | Alta | S |
| Cards horizontales con scroll | Media | S |

**Esfuerzo total estimado:** M

---

## Out of Scope

- Listas personalizadas basadas en preferencias del usuario (requiere recommendation engine).
- Listas por localidad/zona.
- Votar o calificar listas.
- Listas patrocinadas o promocionadas.

---

## Tests

### Archivos que necesitarán tests

| Archivo | Tipo | Qué testear |
|---------|------|-------------|
| `functions/src/admin/featuredLists.ts` | Callable | `toggleFeaturedList` — assertAdmin, validación listId, solo listas públicas |
| `functions/src/scheduled/featuredLists.ts` | Scheduled | Generación de listas automáticas — aggregates parsing, top 10 logic, create/update items |
| `src/services/sharedLists.ts` | Service | `fetchFeaturedLists` — query con `featured == true` |

### Casos a cubrir

- `toggleFeaturedList` rechaza non-admin
- `toggleFeaturedList` rechaza lista privada
- Scheduled function genera 3 listas con los top 10 correctos
- Scheduled function actualiza items existentes (no duplica)
- Query de featured lists filtra correctamente
- UI muestra sección vacía gracefully si no hay featured

### Mock strategy

- Functions: mock `getFirestore`, `assertAdmin`, aggregates doc
- Frontend: mock Firestore queries, `getDocs`

### Criterio de aceptación

- Cobertura ≥ 80% de `toggleFeaturedList` y lógica de generación
- Todos los paths de validación del callable cubiertos

---

## Seguridad

- [ ] `toggleFeaturedList` usa `assertAdmin` — solo admin puede marcar featured
- [ ] Solo listas con `isPublic === true` pueden ser `featured`
- [ ] Firestore rules: agregar lectura de listas con `featured == true` para todos los auth users
- [ ] El `ownerId: 'system'` de listas automáticas no es writable por usuarios normales
- [ ] La scheduled function no expone datos privados en las listas generadas

---

## Success Criteria

1. Existen al menos 3 listas sugeridas visibles para todos los usuarios.
2. El admin puede marcar/desmarcar listas como sugeridas desde el panel.
3. Las listas automáticas se regeneran semanalmente con datos actualizados.
4. Las listas sugeridas aparecen en la sección destacada del menú.
5. Los usuarios pueden copiar una lista sugerida a sus propias listas.
6. Tests del código nuevo pasan con ≥80% de cobertura.
