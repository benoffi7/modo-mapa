# Plan: Mejoras en vista de lista compartida

**Specs:** [specs.md](./specs.md)
**Issue:** #160

---

## Orden de implementación

### Paso 1: Constante `MAX_LISTS`

1. Crear `src/constants/lists.ts` con `MAX_LISTS = 10`
2. Actualizar imports en `SharedListsView.tsx` y `AddToListDialog.tsx`

### Paso 2: `copyList` en service + tests

1. Agregar `copyList()` a `src/services/sharedLists.ts`
2. Crear `src/services/sharedLists.test.ts` con tests:
   - Lista pública se copia OK
   - Lista privada de otro usuario rechaza
   - Límite de 10 listas rechaza
   - Items se copian correctamente
   - Lista vacía se copia sin items

### Paso 3: `addFavoritesBatch` en service + tests

1. Agregar `addFavoritesBatch()` a `src/services/favorites.ts`
2. Actualizar `src/services/favorites.test.ts` con tests:
   - Skip de duplicados existentes
   - Agregar N favoritos nuevos
   - 0 agregados cuando todos existen
   - Cache invalidation llamada 1 vez

### Paso 4: Persistir `activeSharedListId` en MapContext

1. Agregar `activeSharedListId` + `setActiveSharedListId` al `SelectionContext`
2. Agregar state + setter en `MapProvider`

### Paso 5: UI — Botones copiar + favoritos masivos

1. Agregar botones en la vista de shared list de `SharedListsView.tsx`
2. Handlers para copiar lista y favoritos masivos
3. Loading states y toast messages

### Paso 6: Navegación de vuelta

1. En el componente que maneja el SideMenu, detectar cuando `selectedBusiness` vuelve a null y `activeSharedListId` tiene valor
2. Reabrir SideMenu en la sección de listas
3. Limpiar `activeSharedListId` cuando el usuario cierre la lista

### Paso 7: Verificación

- [ ] `npm run test:run` — todos los tests pasan
- [ ] `npm run build` — sin errores
- [ ] Probar flujo completo: abrir shared link → tocar comercio → cerrar BusinessSheet → lista visible
- [ ] Probar copiar lista → verificar en Mis Listas
- [ ] Probar favoritos masivos con duplicados parciales
