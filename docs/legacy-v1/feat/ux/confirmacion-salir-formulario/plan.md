# Plan: Confirmacion al salir de formulario con texto

**Specs:** [specs.md](./specs.md)
**Issue:** #130
**Branch:** `feat/confirmacion-salir-formulario`

---

## Milestone 1: Hook + Dialog (base reutilizable)

**Esfuerzo:** XS

### Tareas

1. Crear `src/hooks/useUnsavedChanges.ts`
   - Implementar `isDirty`, `confirmClose`, `dialogProps`
   - Estado interno: `pendingClose` ref, `dialogOpen` state

2. Crear `src/components/common/DiscardDialog.tsx`
   - Dialog MUI con "Descartar borrador?" / "Seguir editando"
   - Recibe `open`, `onKeepEditing`, `onDiscard`

### Criterio de aceptacion

- Hook exportado y listo para importar
- Dialog renderiza correctamente con props de prueba

---

## Milestone 2: Integracion BusinessSheet

**Esfuerzo:** S

### Tareas

1. `CommentInput.tsx`: agregar prop opcional `onTextChange?: (text: string) => void`
   - Llamar `onTextChange?.(value)` dentro del `onChange` del TextField

2. `BusinessComments.tsx`: agregar prop `onDirtyChange: (dirty: boolean) => void`
   - Trackear dirty state: CommentInput text (via `onTextChange`) + `replyText` + `editText`
   - `useEffect` que llama `onDirtyChange(isDirty)` cuando cambia

3. `BusinessSheet.tsx`:
   - Importar `useUnsavedChanges` y `DiscardDialog`
   - State `commentsDirty` + pasar `onDirtyChange` a `BusinessComments`
   - Reemplazar `handleClose` para pasar por `confirmClose`
   - Renderizar `<DiscardDialog {...dialogProps} />`

### Criterio de aceptacion

- Escribir en CommentInput y cerrar sheet -> dialogo aparece
- Escribir reply y cerrar sheet -> dialogo aparece
- Editar comentario y cerrar sheet -> dialogo aparece
- Sin texto -> cierra directo
- "Seguir editando" -> texto intacto, sheet abierto
- "Descartar" -> sheet cierra, texto se pierde

---

## Milestone 3: Integracion SideMenu (FeedbackForm)

**Esfuerzo:** XS

### Tareas

1. `FeedbackForm.tsx`: agregar prop `onDirtyChange?: (dirty: boolean) => void`
   - `FeedbackSender` recibe el prop, llama en `useEffect` cuando `message` cambia
   - `FeedbackForm` pasa el prop a `FeedbackSender`

2. `SideMenu.tsx`:
   - State `feedbackDirty` + pasar `onDirtyChange` a `FeedbackForm`
   - Importar `useUnsavedChanges` y `DiscardDialog`
   - Envolver `handleClose` con `confirmClose` (solo activo si `activeSection === 'feedback'`)
   - Renderizar `<DiscardDialog {...dialogProps} />`

### Criterio de aceptacion

- Escribir en feedback y cerrar SideMenu -> dialogo aparece
- Estar en otra seccion y cerrar -> cierra directo
- "Seguir editando" -> texto intacto
- "Descartar" -> cierra, texto se pierde

---

## Orden de implementacion

```
M1 (hook + dialog) -> M2 (BusinessSheet) -> M3 (SideMenu)
```

Cada milestone es independiente para deploy. M1 es prerequisito de M2 y M3. M2 y M3 pueden hacerse en paralelo pero se recomienda secuencial para un solo PR.

---

## Checklist pre-merge

- [ ] Lint pasa sin errores
- [ ] Build exitoso
- [ ] Test manual de los 7 escenarios de specs
- [ ] Verificar en mobile (touch accidental en backdrop)
- [ ] Actualizar docs de referencia si corresponde
