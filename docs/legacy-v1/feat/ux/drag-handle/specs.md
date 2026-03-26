# Specs: Drag handle del BusinessSheet poco visible

**PRD:** [drag-handle](./prd.md)
**Issue:** #128
**Estado:** Pendiente revisión

---

## S1: Handle más prominente

### Archivo: `src/components/business/BusinessSheet.tsx`

**Actual** (líneas 66-75):

```tsx
{/* Drag handle */}
<Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
  <Box
    sx={{
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'divider',
    }}
  />
</Box>
```

**Propuesto:**

```tsx
{/* Drag handle */}
<Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
  <Box
    sx={{
      width: 48,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: 'text.secondary',
      opacity: 0.5,
    }}
  />
</Box>
```

### Justificación de cada cambio

| Propiedad | Antes | Después | Por qué |
|-----------|-------|---------|---------|
| `width` | 40 | 48 | +20% más ancho, más fácil de identificar como zona interactiva |
| `height` | 4 | 5 | Ligeramente más grueso, mejor visibilidad |
| `py` | 1 (8px) | 1.5 (12px) | Más espacio de tap target, mejora accesibilidad |
| `borderRadius` | 2 | 2.5 | Proporcional al nuevo height |
| `backgroundColor` | `'divider'` | `'text.secondary'` | `divider` es `rgba(0,0,0,0.12)` en light — casi invisible. `text.secondary` es `#5f6368` (light) / `#9aa0a6` (dark), mucho más visible |
| `opacity` | — | 0.5 | Suaviza el contraste para que sea prominente pero no agresivo |

### Compatibilidad dark mode

- `text.secondary` se resuelve automáticamente por el theme:
  - Light: `#5f6368` al 50% opacity -> contraste suficiente sobre `#ffffff`
  - Dark: `#9aa0a6` al 50% opacity -> contraste suficiente sobre `#1e1e1e`
- No se necesitan valores hardcodeados ni condicionales de modo.

---

## S2: Chevron animado

### Archivo: `src/components/business/BusinessSheet.tsx`

**Nuevo import:**

```tsx
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
```

**Propuesto** (debajo del drag handle Box, dentro del mismo contenedor flex):

```tsx
{/* Drag handle */}
<Box
  sx={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    py: 1.5,
  }}
>
  <Box
    sx={{
      width: 48,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: 'text.secondary',
      opacity: 0.5,
    }}
  />
  <KeyboardArrowUpIcon
    sx={{
      fontSize: 20,
      color: 'text.secondary',
      opacity: 0.6,
      mt: 0.25,
      animation: 'pulseUp 1.5s ease-in-out infinite',
      '@keyframes pulseUp': {
        '0%, 100%': { transform: 'translateY(0)', opacity: 0.6 },
        '50%': { transform: 'translateY(-3px)', opacity: 1 },
      },
    }}
  />
</Box>
```

### Comportamiento

- El chevron se muestra solo cuando el sheet está colapsado (posición inicial).
- No bloquea la interacción de drag — es puramente decorativo.
- La animación `pulseUp` es sutil: 3px de movimiento vertical con fade.

### Nota sobre visibilidad condicional

El `SwipeableDrawer` actual no expone un estado "colapsado vs expandido" (no usa snap points). El chevron siempre se muestra. Si en el futuro se agregan snap points, se puede condicionar con un estado `isExpanded`.

---

## S3: Tooltip primera vez

### Archivo: `src/components/business/BusinessSheet.tsx`

**Nuevo import:**

```tsx
import { Tooltip } from '@mui/material';
```

**localStorage key:** `'dragHandleSeen'`

**Lógica:**

```tsx
const [showTooltip, setShowTooltip] = useState(() => {
  return !localStorage.getItem('dragHandleSeen');
});

useEffect(() => {
  if (showTooltip && isOpen) {
    const timer = setTimeout(() => {
      setShowTooltip(false);
      localStorage.setItem('dragHandleSeen', '1');
    }, 3000);
    return () => clearTimeout(timer);
  }
}, [showTooltip, isOpen]);
```

**UI:** Se envuelve el contenedor del drag handle con `Tooltip`:

```tsx
<Tooltip
  title="Arrastrá hacia arriba para ver más"
  open={showTooltip && isOpen}
  arrow
  placement="top"
>
  <Box sx={{ /* contenedor del drag handle */ }}>
    {/* handle + chevron */}
  </Box>
</Tooltip>
```

- Se muestra solo la primera vez que el usuario ve un BusinessSheet.
- Desaparece a los 3 segundos y setea el flag en localStorage.
- Si el usuario cierra y reabre el sheet antes de los 3s, el timer se limpia y reinicia.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/business/BusinessSheet.tsx` | Rediseño handle, chevron, tooltip |

**Archivos nuevos:** Ninguno.

---

## Dependencias nuevas

**Imports MUI adicionales:**
- `KeyboardArrowUpIcon` de `@mui/icons-material/KeyboardArrowUp`
- `Tooltip` de `@mui/material`

No se agregan dependencias npm nuevas.

---

## Impacto en performance

- Tooltip: un `useState` + `useEffect` con timer -> negligible
- Chevron: CSS animation pura, no JS -> negligible
- localStorage: lectura síncrona una vez al montar -> negligible

---

## Riesgos

- **Bajo**: Cambios cosméticos, no afectan lógica de negocio ni flujo de datos
- La animación CSS `@keyframes` inline en `sx` es soportada por MUI/Emotion sin configuración adicional
