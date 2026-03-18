# Plan: Listas colaborativas — múltiples editores por lista

**Specs:** [specs.md](./specs.md)
**Issue:** #155

---

## Orden de implementación

### Paso 1: Modelo de datos

1. Agregar `editorIds?: string[]` a `SharedList` y `addedBy?: string` a `ListItem` en `src/types/index.ts`
2. Actualizar converters en `src/config/converters.ts`
3. Agregar `MAX_EDITORS_PER_LIST = 5` a `src/constants/lists.ts`

### Paso 2: Firestore rules

1. Agregar funciones `isOwner()` e `isEditor()` en reglas de `sharedLists`
2. Actualizar read: owner OR editor OR public OR featured
3. Actualizar update: owner full, editor solo `itemCount` + `updatedAt`
4. Actualizar create keys para incluir `editorIds` y `featured`
5. Actualizar `listItems` create keys para incluir `addedBy`
6. Crear índice compuesto `editorIds` (Arrays) + `updatedAt` (Desc)

### Paso 3: Callable `inviteListEditor` + tests

1. Crear `functions/src/callable/inviteListEditor.ts`
2. Registrar en `functions/src/index.ts`
3. Crear test con todos los paths: auth, owner, email lookup, límite 5, self-invite, duplicado

### Paso 4: Callable `removeListEditor` + tests

1. Crear `functions/src/callable/removeListEditor.ts`
2. Registrar en `functions/src/index.ts`
3. Crear test: auth, owner check, arrayRemove OK

### Paso 5: Frontend service

1. Agregar `fetchSharedWithMe(userId)` a `src/services/sharedLists.ts`
2. Actualizar `addBusinessToList` para aceptar `addedBy` opcional
3. Agregar tests a `src/services/sharedLists.test.ts`

### Paso 6: UI — EditorsDialog

1. Crear `src/components/menu/EditorsDialog.tsx`
2. Input email + buscar, lista de editores con remover
3. Llamar callables via `httpsCallable`

### Paso 7: UI — SharedListsView actualizaciones

1. Agregar sección "Compartidas conmigo" con fetch de `fetchSharedWithMe`
2. Badge "Colaborativa" en listas con editores
3. Botón "Invitar" en header de lista (solo owner)
4. En modo editor: poder agregar/quitar comercios pero no editar metadata

### Paso 8: Verificación

- [ ] `npm run test:run` — tests frontend pasan
- [ ] `cd functions && npx vitest run` — tests backend pasan
- [ ] `npm run build` — sin errores
- [ ] Probar: owner invita editor → editor agrega comercio → owner ve el comercio
- [ ] Probar: editor no puede eliminar lista ni cambiar nombre
- [ ] Probar: límite de 5 editores enforced
- [ ] Probar: "Compartidas conmigo" muestra las listas correctas
- [ ] Deploy rules + functions a staging
- [ ] Verificar índice de Firestore creado

---

## Dependencia con otros issues

- **Requiere** #160 (mejoras lista compartida) implementado primero — para la constante `MAX_LISTS` en `constants/lists.ts`
- **Requiere** #156 (listas sugeridas) para el campo `featured` en rules y tipo
- **Orden recomendado:** #160 → #156 → #155
