# Plan: Listas sugeridas por la plataforma

**Specs:** [specs.md](./specs.md)
**Issue:** #156

---

## Orden de implementación

### Paso 1: Tipo + Converter + Rules

1. Agregar `featured?: boolean` a `SharedList` en `src/types/index.ts`
2. Actualizar `sharedListConverter` en `src/config/converters.ts`
3. Actualizar Firestore rules: read para `featured == true`, keys en create

### Paso 2: Callable `toggleFeaturedList` + tests

1. Crear `functions/src/admin/featuredLists.ts`
2. Registrar en `functions/src/index.ts`
3. Crear test: admin guard, lista privada rechazada, toggle OK

### Paso 3: Scheduled `generateFeaturedLists` + tests

1. Crear `functions/src/scheduled/featuredLists.ts`
2. Registrar en `functions/src/index.ts`
3. Crear test: aggregates parsing, top 10 sort, mínimo 3 ratings filter, batch upsert

### Paso 4: Frontend service `fetchFeaturedLists`

1. Agregar función a `src/services/sharedLists.ts`
2. Agregar test a `src/services/sharedLists.test.ts`

### Paso 5: UI — Sección Destacadas

1. Agregar fetch + render de featured lists en `SharedListsView.tsx`
2. Cards horizontales scrolleables con badge "Destacada"
3. Click abre la vista de shared list (reusa la existente)

### Paso 6: Admin UI — Toggle featured

1. Agregar sección en admin para toggle featured en listas públicas
2. Llamar callable `toggleFeaturedList`

### Paso 7: Verificación

- [ ] `npm run test:run` — todos los tests pasan
- [ ] `cd functions && npx vitest run` — tests de functions pasan
- [ ] `npm run build` — sin errores
- [ ] Probar toggle featured desde admin
- [ ] Verificar que las listas destacadas aparecen en el menú
- [ ] Verificar que las reglas de Firestore permiten leer featured lists sin ser owner
- [ ] Deploy rules a staging si es necesario
