# Plan: Conectar listas colaborativas a la UI

**Specs:** [specs.md](specs.md)
**Fecha:** 2026-03-29

---

## Fases de implementacion

### Fase 1: Conectar dialogs y permisos en ListDetailScreen

**Branch:** `feat/conectar-listas-colaborativas-ui`

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/ListDetailScreen.tsx` | Agregar imports: `EditorsDialog`, `InviteEditorDialog`, `Badge` de MUI, `GroupIcon`, `PersonAddIcon`, `fetchSharedList` de services |
| 2 | `src/components/lists/ListDetailScreen.tsx` | Agregar state: `const [editorIds, setEditorIds] = useState(list.editorIds)`, `const [editorsOpen, setEditorsOpen] = useState(false)`, `const [inviteOpen, setInviteOpen] = useState(false)` |
| 3 | `src/components/lists/ListDetailScreen.tsx` | Agregar variable `isEditor = !isOwner && !!user && editorIds.includes(user.uid)`. Renombrar `canEdit` a `canEditConfig = isOwner && !readOnly`. Agregar `canEditItems = (isOwner \|\| isEditor) && !readOnly` |
| 4 | `src/components/lists/ListDetailScreen.tsx` | Refactorizar toolbar: el bloque `{canEdit && (<>...palette, visibility, share, delete...</>)}` pasa a usar `canEditConfig`. Agregar dentro del bloque `canEditConfig` dos nuevos IconButtons: (a) boton editores con `GroupIcon` envuelto en `Badge` con `badgeContent={editorIds.length}` invisible si 0, (b) boton invitar con `PersonAddIcon` |
| 5 | `src/components/lists/ListDetailScreen.tsx` | En la seccion de items, cambiar `{canEdit && (` a `{canEditItems && (` para el boton de remover item |
| 6 | `src/components/lists/ListDetailScreen.tsx` | Agregar `handleEditorsChanged` callback: llama `fetchSharedList(list.id)`, si resultado no null actualiza `setEditorIds(result.editorIds)`. Wrap en try/catch con `logger.warn` |
| 7 | `src/components/lists/ListDetailScreen.tsx` | Montar `<EditorsDialog open={editorsOpen} onClose={() => setEditorsOpen(false)} listId={list.id} editorIds={editorIds} onEditorRemoved={handleEditorsChanged} />` despues del `<ColorPicker>` |
| 8 | `src/components/lists/ListDetailScreen.tsx` | Montar `<InviteEditorDialog listId={inviteOpen ? list.id : null} onClose={() => setInviteOpen(false)} onInvited={handleEditorsChanged} />` despues del `<EditorsDialog>` |
| 9 | `src/components/lists/ListDetailScreen.tsx` | Actualizar `onBack` call para incluir `editorIds` en el partial: `onBack({ id: list.id, color: currentColor, itemCount: items.length, isPublic, editorIds })` |

### Fase 2: Actualizar CollaborativeTab

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/CollaborativeTab.tsx` | Remover `readOnly` del `<ListDetailScreen>` (linea 51). Esto permite que `isEditor` funcione y el editor vea el boton de quitar items |

### Fase 3: Tests

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Crear archivo de test. Setup mocks para services, contexts, hooks, y child components (`EditorsDialog`, `InviteEditorDialog`, `ColorPicker`) |
| 2 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "owner ve botones de palette, visibilidad, editores, invitar y delete en toolbar" |
| 3 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "owner ve badge con count de editores cuando editorIds tiene elementos" |
| 4 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "editor ve boton de quitar items pero NO ve botones de config" |
| 5 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "readOnly no ve ninguna accion (ni toolbar ni remove item)" |
| 6 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "click en boton editores abre EditorsDialog" |
| 7 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "click en boton invitar abre InviteEditorDialog" |
| 8 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "onEditorRemoved refetcha editorIds via fetchSharedList" |
| 9 | `src/components/lists/__tests__/ListDetailScreen.test.tsx` | Test: "onBack incluye editorIds actualizado" |

### Fase 4: Verificacion end-to-end

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | N/A | Ejecutar `npm run dev:full` (Vite + Firebase emulators) |
| 2 | N/A | Verificar flujo: crear lista -> invitar editor por email -> aceptar (simular con emuladores) -> editor agrega item -> owner remueve editor -> editor ya no puede modificar |
| 3 | N/A | Verificar que `CollaborativeTab` muestra la lista al editor y permite quitar items |

### Fase 5: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Agregar nota en seccion de listas: "Editores pueden agregar/quitar items desde CollaborativeTab. Owner gestiona editores desde ListDetailScreen" |
| 2 | `docs/reference/patterns.md` | Agregar en seccion "Shared lists": nota sobre permisos owner vs editor en ListDetailScreen |

---

## Orden de implementacion

1. `src/components/lists/ListDetailScreen.tsx` -- es el componente central, todas las demas fases dependen de el
2. `src/components/lists/CollaborativeTab.tsx` -- cambio de 1 linea, depende de que ListDetailScreen ya maneje permisos internamente
3. `src/components/lists/__tests__/ListDetailScreen.test.tsx` -- tests del componente modificado
4. Verificacion end-to-end con emuladores
5. Documentacion

## Estimacion de tamanio de archivos

| Archivo | Lineas actuales | Lineas estimadas | Estado |
|---------|----------------|-----------------|--------|
| `ListDetailScreen.tsx` | 201 | ~250 | Ideal |
| `CollaborativeTab.tsx` | 80 | 80 (sin cambio neto) | Ideal |
| `ListDetailScreen.test.tsx` | 0 (nuevo) | ~200 | Ideal |

## Riesgos

1. **`fetchSharedList` falla despues de invite/remove**: El editor se invito correctamente server-side pero el refetch falla. **Mitigacion**: try/catch con logger.warn. La UI muestra los datos previos (stale pero no incorrecto). El usuario puede cerrar y reabrir para refrescar.

2. **Race condition entre refetch y dialog close**: Si el usuario cierra el dialog antes de que el refetch complete. **Mitigacion**: el refetch actualiza `editorIds` state independientemente del estado del dialog. No hay dependencia entre ambos.

3. **Editor confundido por UI limitada**: El editor ve la lista pero no entiende por que no puede cambiar el color/nombre. **Mitigacion**: fuera de scope actual. Se puede agregar un tooltip explicativo en una iteracion futura.

## Guardrails de modularidad

- [x] Ningun componente nuevo importa `firebase/firestore` directamente (el refetch usa `fetchSharedList` del service layer)
- [x] Archivos nuevos en carpeta de dominio correcta (`components/lists/`, `components/lists/__tests__/`)
- [x] Logica de negocio en services (los servicios ya existen), no en componentes
- [x] No se toca ningun archivo con deuda tecnica conocida
- [x] Ningun archivo resultante supera 400 lineas (max estimado: ~250 lineas)

## Fase final: Documentacion (OBLIGATORIA)

| Paso | Archivo | Cambio |
|------|---------|--------|
| 1 | `docs/reference/features.md` | Actualizar seccion de listas colaborativas con la nota de que owners gestionan editores desde ListDetailScreen |
| 2 | `docs/reference/patterns.md` | Agregar en seccion "Shared lists" patron de permisos owner vs editor vs readOnly en ListDetailScreen |

## Criterios de done

- [ ] All items from PRD scope implemented
- [ ] Tests pass with >= 80% coverage on new code
- [ ] No lint errors
- [ ] Build succeeds
- [ ] Seed data updated (if schema changed) -- N/A, no schema changes
- [ ] Privacy policy reviewed (if new data collection) -- N/A, no new data collection
- [ ] Reference docs updated (features.md, patterns.md)
