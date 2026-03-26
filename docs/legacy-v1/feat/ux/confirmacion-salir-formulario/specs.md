# Specs: Confirmacion al salir de formulario con texto

**PRD:** [prd.md](./prd.md)
**Issue:** #130
**Estado:** Pendiente de revision

---

## Scope

Solo S1 (deteccion de contenido) y S2 (dialogo de confirmacion). S3 (borradores en localStorage) queda fuera de esta iteracion.

---

## Hook: `useUnsavedChanges`

**Archivo nuevo:** `src/hooks/useUnsavedChanges.ts`

```typescript
interface UseUnsavedChangesReturn {
  /** True when any tracked field has content */
  isDirty: boolean;
  /** Call before a close action. Returns true if close is safe (no dirty content or user confirmed discard). */
  confirmClose: (onClose: () => void) => void;
  /** MUI Dialog props — render once alongside the component */
  dialogProps: {
    open: boolean;
    onKeepEditing: () => void;
    onDiscard: () => void;
  };
}

function useUnsavedChanges(...values: string[]): UseUnsavedChangesReturn;
```

**Logica:**
- `isDirty = values.some(v => v.trim().length > 0)`
- `confirmClose(onClose)`: si `!isDirty`, ejecuta `onClose()` directo. Si `isDirty`, setea `pendingClose = onClose` y abre el dialogo.
- `onDiscard`: ejecuta `pendingClose()`, cierra dialogo, limpia ref.
- `onKeepEditing`: cierra dialogo, limpia ref.

Estado interno: `pendingClose: (() => void) | null` (con `useRef` para evitar re-renders).

---

## Componente: `DiscardDialog`

**Archivo nuevo:** `src/components/common/DiscardDialog.tsx`

Componente presentacional puro que recibe las `dialogProps` del hook.

```typescript
interface DiscardDialogProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}
```

**UI (MUI Dialog):**

| Elemento | Valor |
|----------|-------|
| `DialogTitle` | "Descartar borrador?" |
| `DialogContentText` | "Tenes texto sin enviar. Si cerras, se va a perder." |
| Boton izquierdo | "Descartar" — `color="error"`, `variant="text"`, llama `onDiscard` |
| Boton derecho | "Seguir editando" — `variant="contained"`, llama `onKeepEditing`, `autoFocus` |

Sigue el patron de `BackupConfirmDialog`: `Dialog` + `DialogTitle` + `DialogContent` + `DialogActions`.

---

## Integracion: BusinessSheet

**Archivo:** `src/components/business/BusinessSheet.tsx`

El `BusinessSheet` no tiene acceso directo al estado de texto de `CommentInput` ni de `BusinessComments` (reply/edit). Se necesita un mecanismo para comunicar el dirty state hacia arriba.

**Estrategia: callback ref via prop**

1. `BusinessComments` recibe un nuevo prop `onDirtyChange: (dirty: boolean) => void`.
2. Dentro de `BusinessComments`, se computa `isDirty` como:
   - `CommentInput` text > 0 (requiere exponer el state), **o**
   - `replyText.trim().length > 0`, **o**
   - `editText.trim().length > 0`
3. Un `useEffect` llama `onDirtyChange(isDirty)` cuando cambia.
4. `CommentInput` recibe un nuevo prop `onTextChange?: (text: string) => void` que se invoca junto al `setText`. `BusinessComments` usa esto para trackear el dirty state del input principal.

**En `BusinessSheet`:**

```typescript
const [commentsDirty, setCommentsDirty] = useState(false);
const { confirmClose, dialogProps } = useUnsavedChanges(
  commentsDirty ? 'x' : '' // isDirty shortcut
);

const handleClose = () => {
  confirmClose(() => setSelectedBusiness(null));
};
```

Se renderiza `<DiscardDialog {...dialogProps} />` dentro del return.

---

## Integracion: SideMenu (FeedbackForm)

**Archivo:** `src/components/layout/SideMenu.tsx`

El `SideMenu` cierra via `handleClose` que llama `onClose()`.

**Estrategia:**

1. `FeedbackForm` (via `FeedbackSender`) recibe `onDirtyChange: (dirty: boolean) => void`.
2. `FeedbackSender` llama `onDirtyChange(message.trim().length > 0)` en un `useEffect`.
3. `SideMenu` mantiene `feedbackDirty` state y usa `useUnsavedChanges` en `handleClose`.

**Nota:** Solo aplica cuando `activeSection === 'feedback'`. Si el usuario esta en otra seccion, no hay texto que proteger.

```typescript
const [feedbackDirty, setFeedbackDirty] = useState(false);
const { confirmClose, dialogProps } = useUnsavedChanges(
  activeSection === 'feedback' && feedbackDirty ? 'x' : ''
);

const handleClose = () => {
  confirmClose(() => {
    onClose();
    setTimeout(() => setActiveSection('nav'), 300);
  });
};
```

---

## Integracion: NameDialog

**Descartada.** El `NameDialog` es un flujo obligatorio de onboarding que no se puede cerrar (no tiene `onClose`). No aplica confirmacion.

---

## Integracion: SideMenu edit name dialog

**Descartada.** El dialogo de edicion de nombre ya tiene boton "Cancelar" explicito. El usuario entiende que cierra el dialogo. El texto es corto (max 30 chars). No justifica un segundo dialogo de confirmacion.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useUnsavedChanges.ts` | **Nuevo.** Hook reutilizable (~30 lineas) |
| `src/components/common/DiscardDialog.tsx` | **Nuevo.** Componente presentacional (~25 lineas) |
| `src/components/business/CommentInput.tsx` | Agregar prop `onTextChange` opcional, llamarlo en `setText` |
| `src/components/business/BusinessComments.tsx` | Agregar prop `onDirtyChange`, computar dirty desde CommentInput + reply + edit |
| `src/components/business/BusinessSheet.tsx` | Usar `useUnsavedChanges` + `DiscardDialog`, pasar `onDirtyChange` a `BusinessComments` |
| `src/components/menu/FeedbackForm.tsx` | Agregar prop `onDirtyChange` a `FeedbackSender`, exponer desde `FeedbackForm` |
| `src/components/layout/SideMenu.tsx` | Usar `useUnsavedChanges` + `DiscardDialog` en `handleClose` |

---

## Tipos nuevos

Ninguno. Las interfaces son locales a los archivos nuevos.

---

## Dependencias nuevas

Ninguna. Solo imports de MUI ya presentes en el proyecto (`Dialog`, `DialogTitle`, `DialogContent`, `DialogContentText`, `DialogActions`, `Button`).

---

## Tests

No se agregan tests unitarios en esta iteracion. El hook es trivial (condicional + ref). Se valida manualmente:
1. Escribir en CommentInput, cerrar BusinessSheet -> dialogo aparece.
2. Escribir reply, cerrar BusinessSheet -> dialogo aparece.
3. Editar comentario, cerrar BusinessSheet -> dialogo aparece.
4. Escribir feedback, cerrar SideMenu -> dialogo aparece.
5. Campo vacio, cerrar -> sin dialogo.
6. "Seguir editando" -> texto intacto.
7. "Descartar" -> cierra sin texto.

---

## Impacto en performance

- `useUnsavedChanges`: un `useRef` + un `useState(boolean)` -> negligible.
- `onDirtyChange` callback: un `useEffect` que compara strings -> negligible.
- `DiscardDialog` se renderiza con `open={false}` la mayoria del tiempo -> MUI no monta el contenido.
