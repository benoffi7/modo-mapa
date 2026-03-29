# Plan: Descomponer CommentsList.tsx

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-28

---

## Fases de implementacion

### Fase 1: Extraer CommentsListItem

**Branch:** `refactor/descomponer-comments-list`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/menu/CommentsListItem.tsx` | Crear archivo nuevo. Mover la interfaz `CommentItemProps` (renombrada a `CommentsListItemProps`) y el componente memo `CommentItem` (renombrado a `CommentsListItem`) desde `CommentsList.tsx` lineas 43-244. Agregar todos los imports necesarios: `memo` de React, componentes MUI (`Box`, `List`, `ListItemButton`, `ListItemText`, `IconButton`, `Typography`, `TextField`), iconos (`ChatBubbleOutlineIcon`, `HelpOutlineIcon`, `DeleteOutlineIcon`, `EditOutlinedIcon`, `CheckIcon`, `FavoriteIcon`, `CloseIcon`), `useSwipeActions` type, `MAX_COMMENT_LENGTH`, `formatRelativeTime`, `truncate`, tipos `Business` y `Comment`. Exportar `CommentsListItemProps` (named) y `CommentsListItem` (default). |
| 2 | `src/components/menu/CommentsList.tsx` | Eliminar la interfaz `CommentItemProps` (lineas 43-59) y el componente `CommentItem` (lineas 61-244). Eliminar imports que ya no se usan en este archivo: `memo`, `TextField`, `HelpOutlineIcon`, `DeleteOutlineIcon`, `EditOutlinedIcon`, `CheckIcon`, `FavoriteIcon`, `CloseIcon`, `MAX_COMMENT_LENGTH`, `formatRelativeTime`, `truncate`. Agregar import de `CommentsListItem` desde `./CommentsListItem`. Reemplazar `<CommentItem` por `<CommentsListItem` en las dos instancias (linea 388 y 437). |

### Fase 2: Extraer CommentsListContent

| Paso | Archivo | Cambio |
|------|---------|--------|
| 3 | `src/components/menu/CommentsListContent.tsx` | Crear archivo nuevo. Definir `CommentsListContentProps` con las props documentadas en specs. Importar `CommentsListItem` desde `./CommentsListItem`, `Box` y `List` de MUI, `type RefCallback` de React, tipos necesarios. El componente renderiza: (a) si `filteredComments` esta vacio, retorna `null`; (b) si `!shouldVirtualize`, renderiza `<List disablePadding>` con `.map()` instanciando `CommentsListItem` para cada item; (c) si `shouldVirtualize`, renderiza el container con `scrollContainerRef`, `<List>` con `height` del virtualizer, y `.getVirtualItems().map()` con posicionamiento absoluto y `measureElement`. Exportar default. |
| 4 | `src/components/menu/CommentsList.tsx` | Reemplazar los dos bloques de renderizado de la lista (lineas 385-408 para normal, lineas 410-458 para virtualizado) por un unico `<CommentsListContent>` que recibe todas las props necesarias. Eliminar imports que ya no se usan: `List`, `ListItemButton`, `ListItemText`, `type RefCallback`. Agregar import de `CommentsListContent` desde `./CommentsListContent`. Eliminar import de `CommentsListItem` (ahora lo importa `CommentsListContent`). |

### Fase 3: Verificacion

| Paso | Archivo | Cambio |
|------|---------|--------|
| 5 | — | Ejecutar `npx tsc --noEmit` para verificar que no hay errores de tipos. |
| 6 | — | Ejecutar `npx eslint src/components/menu/CommentsList.tsx src/components/menu/CommentsListItem.tsx src/components/menu/CommentsListContent.tsx` para verificar lint. |
| 7 | — | Ejecutar `npm run build` para verificar que el build pasa. |
| 8 | — | Verificar con `wc -l` que `CommentsList.tsx` < 300 lineas, `CommentsListItem.tsx` < 400, `CommentsListContent.tsx` < 400. |
| 9 | — | Commit con mensaje descriptivo del refactor. |

---

## Orden de implementacion

1. `src/components/menu/CommentsListItem.tsx` -- sin dependencias, se puede crear primero
2. `src/components/menu/CommentsList.tsx` -- actualizar para importar `CommentsListItem` y eliminar codigo movido
3. `src/components/menu/CommentsListContent.tsx` -- depende de `CommentsListItem`
4. `src/components/menu/CommentsList.tsx` -- actualizar para importar `CommentsListContent` y eliminar renderizado duplicado
5. Verificacion de build, lint y line counts

En la practica, los pasos 1-2 se hacen juntos (Fase 1) y los pasos 3-4 se hacen juntos (Fase 2).

## Riesgos

1. **Imports circulares**: `CommentsListContent` importa `CommentsListItem`, y `CommentsList` importa `CommentsListContent`. La cadena es unidireccional, sin riesgo de circularidad. Mitigacion: verificar con `npx tsc --noEmit`.

2. **Props drilling excesivo**: `CommentsListContent` recibe ~15 props para pasarlas a `CommentsListItem`. Esto es aceptable para un refactor de extraccion sin cambios funcionales. Si en el futuro crece, se puede agrupar en un objeto `itemProps`. Mitigacion: la interfaz esta documentada y tipada.

3. **Regresion visual**: El refactor es puramente estructural pero un error en la copia podria causar diferencias de renderizado. Mitigacion: verificar manualmente que la lista de comentarios se ve y funciona identicamente (swipe, edit, delete, virtualizacion).

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] `CommentsList.tsx` tiene menos de 300 lineas
- [ ] Ningun archivo nuevo supera 400 lineas
- [ ] `CommentsListItem.tsx` es un componente memo con props explicitas
- [ ] `CommentsListContent.tsx` encapsula renderizado normal y virtualizado
- [ ] Build pasa sin errores (`npm run build`)
- [ ] Lint pasa sin errores
- [ ] TypeScript compila sin errores (`npx tsc --noEmit`)
- [ ] No hay tests rotos (`npm run test:run`)
- [ ] Comportamiento identico al actual (verificacion manual)
