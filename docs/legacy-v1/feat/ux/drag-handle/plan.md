# Plan: Drag handle del BusinessSheet poco visible

**Issue:** #128
**Branch:** `feat/drag-handle`

---

## Pasos de implementación

### 1. Rediseño visual del drag handle (S1)

- En `BusinessSheet.tsx`, actualizar el `Box` del drag handle:
  - `width: 40` -> `48`, `height: 4` -> `5`
  - `py: 1` -> `1.5` (más tap target)
  - `backgroundColor: 'divider'` -> `'text.secondary'` con `opacity: 0.5`
  - `borderRadius: 2` -> `2.5`

### 2. Chevron animado (S2)

- Agregar import de `KeyboardArrowUpIcon`
- Cambiar el contenedor del handle a `flexDirection: 'column'`
- Agregar `KeyboardArrowUpIcon` debajo del handle con animación CSS `pulseUp`

### 3. Tooltip primera vez (S3)

- Agregar import de `Tooltip`
- Agregar estado `showTooltip` inicializado desde `localStorage('dragHandleSeen')`
- Agregar `useEffect` con timer de 3s que oculta el tooltip y setea el flag
- Envolver el contenedor del handle con `Tooltip`

### 4. Verificación local

- Abrir la app y seleccionar un comercio
- Verificar que el handle es visualmente más prominente
- Verificar que el chevron se anima sutilmente
- Verificar que el tooltip aparece la primera vez y no reaparece
- Verificar en dark mode (si disponible) que los colores tienen buen contraste
- Limpiar `localStorage.removeItem('dragHandleSeen')` para re-testear el tooltip

### 5. PR

- Commit, push a `feat/drag-handle`
- Crear PR referenciando #128
