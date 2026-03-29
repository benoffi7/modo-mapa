# Plan: Conectar IconPicker a la UI de listas

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Servicio y constantes

**Branch:** `feat/conectar-iconpicker-listas`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/services/sharedLists.ts` | Agregar import de `getListIconById` desde `constants/listIcons`. Modificar firma de `createList` para aceptar `icon?: string` como cuarto parametro. Dentro del body, validar con `getListIconById(icon)`: si es valido, agregar `icon` al objeto de `addDoc`. Modificar firma de `updateList` para aceptar `icon?: string` como quinto parametro. Si `icon !== undefined`, agregar `icon` al objeto `data`. |
| 2 | `src/constants/analyticsEvents.ts` | Agregar `export const EVT_LIST_ICON_CHANGED = 'list_icon_changed';` |
| 3 | `src/constants/messages/list.ts` | Agregar `iconError: 'Error al cambiar icono',` al objeto `MSG_LIST` |
| 4 | `src/__tests__/constants/listIcons.test.ts` | Crear test file para `getListIconById`: ID valido retorna option, ID invalido retorna undefined, undefined retorna undefined, string vacio retorna undefined. Verificar que `LIST_ICON_OPTIONS` tiene 30 elementos y todos los IDs son unicos. |
| 5 | `src/__tests__/services/sharedLists.test.ts` | Crear test file para `createList` (con icon, sin icon, con icon invalido) y `updateList` (con icon, sin icon). Mock de firebase/firestore, config/firebase, config/collections, queryCache, analytics. |

### Fase 2: Componentes UI

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/CreateListDialog.tsx` | Agregar imports: `useState` (ya existe), `Box`, `IconButton` o `Button` desde MUI, `InsertEmoticonOutlined` desde MUI icons, `IconPicker` desde `./IconPicker`, `getListIconById` desde `constants/listIcons`. Agregar estados `selectedIcon` y `iconPickerOpen`. Agregar boton de seleccion de icono debajo del TextField de descripcion. Renderizar `IconPicker`. En `handleCreate`, pasar `selectedIcon` a `createList`. Modificar la firma del callback `onCreated` para incluir `icon?`. Limpiar `selectedIcon` al crear. |
| 2 | `src/components/lists/ListDetailScreen.tsx` | Agregar imports: `InsertEmoticonOutlined` desde MUI icons, `IconPicker` desde `./IconPicker`, `getListIconById` desde `constants/listIcons`, `EVT_LIST_ICON_CHANGED` desde `constants/analyticsEvents`, `trackEvent` desde `utils/analytics`, `MSG_LIST` (ya importado). Agregar estados `iconPickerOpen` y `currentIcon`. Agregar `IconButton` en toolbar junto al boton de color. Crear handler `handleIconChange` con optimistic update + `updateList` + analytics + toast de error. Renderizar `IconPicker`. Agregar `icon: currentIcon` al objeto `onBack`. |
| 3 | `src/components/lists/SharedListsView.tsx` | Modificar el callback `onCreated` de `CreateListDialog` para aceptar cuarto parametro `icon?: string`. Agregar `icon` al objeto de la nueva lista en `setLists`. |

---

## Orden de implementacion

1. `src/constants/analyticsEvents.ts` -- nueva constante (sin dependencias)
2. `src/constants/messages/list.ts` -- nueva constante (sin dependencias)
3. `src/services/sharedLists.ts` -- depende de `constants/listIcons` (ya existe)
4. `src/__tests__/constants/listIcons.test.ts` -- tests del modulo existente
5. `src/__tests__/services/sharedLists.test.ts` -- tests del servicio modificado
6. `src/components/lists/CreateListDialog.tsx` -- depende del servicio modificado
7. `src/components/lists/ListDetailScreen.tsx` -- depende del servicio modificado
8. `src/components/lists/SharedListsView.tsx` -- depende de CreateListDialog modificado

---

## Estimacion de tamano de archivos

| Archivo | Lineas actuales | Lineas estimadas post-cambio | Dentro del limite? |
|---------|----------------|-----------------------------|--------------------|
| `src/services/sharedLists.ts` | 247 | ~260 | Si (< 400) |
| `src/components/lists/CreateListDialog.tsx` | 62 | ~100 | Si (< 400) |
| `src/components/lists/ListDetailScreen.tsx` | 201 | ~235 | Si (< 400) |
| `src/components/lists/SharedListsView.tsx` | 188 | ~190 | Si (< 400) |
| `src/__tests__/services/sharedLists.test.ts` | 0 (nuevo) | ~120 | Si (< 400) |
| `src/__tests__/constants/listIcons.test.ts` | 0 (nuevo) | ~40 | Si (< 400) |

---

## Riesgos

1. **Llamadas existentes a `updateList` con parametros posicionales**: `updateList` actualmente recibe `(listId, name, description, color?)`. Al agregar `icon?` como quinto parametro, las llamadas existentes que solo pasan 3-4 parametros no se ven afectadas. Pero `ListDetailScreen.handleColorChange` llama `updateList(list.id, list.name, list.description, hex)` -- sigue funcionando porque `icon` queda como `undefined`. **Riesgo bajo.**

2. **IconPicker ya llama `onClose()` internamente**: El componente `IconPicker` hace `onSelect(icon); onClose()` en el mismo click handler. Si el parent tambien llama `onClose` en respuesta a `onSelect`, no hay problema porque cerrar un dialog ya cerrado es idempotente. **Riesgo nulo.**

3. **`onCreated` firma change en CreateListDialog**: Al agregar un cuarto parametro, hay que verificar que todos los call sites lo soporten. Solo hay un call site: `SharedListsView`. Se actualiza en Fase 2 paso 3. **Riesgo bajo.**

---

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente
- [x] Archivos nuevos en carpeta de dominio correcta (tests en `__tests__/`, constantes en `constants/`)
- [x] Logica de negocio en services (`sharedLists.ts`), no en componentes
- [x] No se toca archivo con deuda tecnica conocida sin incluir fix (se agregan tests para `sharedLists.ts`)
- [x] Ningun archivo resultante supera 400 lineas

---

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Documentar que las listas ahora soportan seleccion de icono en creacion y edicion |
| 2 | `docs/reference/tests.md` | Actualizar inventario: agregar `sharedLists.test.ts` y `listIcons.test.ts` al inventario, marcar `sharedLists.ts` como parcialmente cubierto |

---

## Criterios de done

- [x] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Seed data updated (if schema changed) -- N/A, no schema change
- [ ] Privacy policy reviewed (if new data collection) -- N/A, no new data
- [ ] Reference docs updated (features.md, tests.md)
