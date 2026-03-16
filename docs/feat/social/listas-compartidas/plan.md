# Plan: Listas compartidas

**Feature:** listas-compartidas
**Issue:** #142

---

## Paso 1: Tipos y collections

- Agregar `SharedList` y `ListItem` a `src/types/index.ts`
- Agregar `SHARED_LISTS` y `LIST_ITEMS` a `src/config/collections.ts`

## Paso 2: Converters

- Agregar `sharedListConverter` y `listItemConverter` a `src/config/converters.ts`

## Paso 3: Firestore rules

- Agregar rules para `sharedLists` y `listItems` en `firestore.rules`

## Paso 4: Service layer

- Crear `src/services/sharedLists.ts` con CRUD + items management

## Paso 5: SharedListsView

- Crear `src/components/menu/SharedListsView.tsx`
- Lista de listas, crear, eliminar, compartir, ver items

## Paso 6: AddToListDialog

- Crear `src/components/business/AddToListDialog.tsx`
- Dialog con checkboxes por lista + crear nueva inline

## Paso 7: Integrar en BusinessSheet

- Agregar BookmarkIcon button que abre AddToListDialog

## Paso 8: Integrar en SideMenu

- Agregar 'lists' section, lazy import, nav item

## Paso 9: Deep link

- En AppShell, detectar `?list={id}` y navegar a la lista

## Paso 10: Tests

- Lint, frontend tests, functions tests, build

---

## Criterios de merge

- [ ] Crear/editar/eliminar listas funciona
- [ ] Agregar/quitar comercios de listas funciona
- [ ] Vista en menú lateral muestra listas con items
- [ ] Link compartido abre la lista para otros usuarios autenticados
- [ ] Botón en BusinessSheet abre dialog de listas
- [ ] Firestore rules validan correctamente
- [ ] Lint y tests pasan
- [ ] Docs actualizados (features, patterns, help, PROJECT_REFERENCE)
