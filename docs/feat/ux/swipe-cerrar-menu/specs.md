# Specs: Gesto swipe para cerrar menu lateral

**PRD:** [PRD](./prd.md)
**Estado:** Aprobado

---

## Cambio principal: Drawer a SwipeableDrawer

### Componente: `SideMenu.tsx`

Reemplazar `Drawer` por `SwipeableDrawer` de MUI. El componente ya recibe `open` y `onClose` como props; `SwipeableDrawer` requiere adicionalmente `onOpen`.

**Props del SwipeableDrawer:**

| Prop | Valor | Motivo |
|------|-------|--------|
| `anchor` | `"left"` | Sin cambio, ya existe |
| `open` | `open` | Sin cambio |
| `onClose` | `handleClose` | Sin cambio |
| `onOpen` | no-op (`() => {}`) | Requerido por API; la apertura se controla externamente via estado del padre |
| `swipeAreaWidth` | `20` | Zona de activacion en el borde izquierdo (px) |
| `disableSwipeToOpen` | `false` | Permite abrir con swipe desde el borde |
| `disableBackdropTransition` | `true` | Mejora performance en iOS Safari |
| `disableDiscovery` | `true` | Evita "peek" no deseado en iOS |

**Nota sobre `onOpen`:** El SideMenu se abre desde el boton hamburguesa en `MapToolbar`. El `onOpen` del SwipeableDrawer se invoca cuando el usuario hace swipe desde el borde. Como el estado `open` vive en el padre, `onOpen` debe llamar al setter del padre. Se necesita agregar una prop `onOpen` a la interfaz de `SideMenu`.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/SideMenu.tsx` | Reemplazar `Drawer` por `SwipeableDrawer`, agregar prop `onOpen`, configurar props de swipe |
| Componente padre que renderiza SideMenu | Pasar `onOpen` con el setter que abre el menu |

---

## Cambios en la interfaz Props

```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;       // NUEVO — requerido por SwipeableDrawer
  initialSection?: string | undefined;
  sharedListId?: string | undefined;
}
```

---

## Imports

**Quitar:**
```typescript
import { Drawer, ... } from '@mui/material';
```

**Agregar:**
```typescript
import { SwipeableDrawer, ... } from '@mui/material';
```

`SwipeableDrawer` se exporta desde `@mui/material` — no requiere dependencias npm nuevas.

---

## Dependencias nuevas

Ninguna. `SwipeableDrawer` ya viene incluido en `@mui/material`.

---

## Tests

No se agregan tests nuevos. Verificacion manual:
1. Swipe izquierda cierra el menu
2. Swipe desde borde izquierdo abre el menu
3. Boton hamburguesa sigue funcionando
4. Click fuera sigue cerrando
5. Performance fluida en iOS Safari

---

## Impacto en performance

Negligible. `SwipeableDrawer` agrega listeners de touch que solo se activan en interaccion. Las optimizaciones iOS (`disableBackdropTransition`, `disableDiscovery`) reducen overhead en Safari.
