# Specs: Mapa navegable por teclado

**PRD:** [PRD](./prd.md)
**Estado:** Pendiente de aprobacion

---

## S1: Markers focuseables con Tab + Enter/Space

**Componente:** `BusinessMarker.tsx`

El `AdvancedMarker` de `@vis.gl/react-google-maps` renderiza un elemento DOM dentro del overlay del mapa. Se necesita acceder al elemento DOM interno para hacerlo focuseable.

**Estrategia:** Usar la prop `onClick` existente y agregar un wrapper `<div>` alrededor de `<Pin>` con atributos de accesibilidad:

```tsx
<AdvancedMarker position={...} onClick={handleClick}>
  <div
    tabIndex={0}
    role="button"
    aria-label={ariaLabel}
    onKeyDown={handleKeyDown}
    style={{ outline: 'none' }} // outline custom via className
    className={`marker-focus ${isSelected ? 'marker-selected' : ''}`}
  >
    <Pin ... />
  </div>
</AdvancedMarker>
```

**Keyboard handler:**

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onClick(business.id);
  }
}, [onClick, business.id]);
```

**Props nuevas en `BusinessMarker`:**

| Prop | Tipo | Descripcion |
|------|------|-------------|
| `averageRating` | `number \| null` | Rating promedio para el aria-label |

El `averageRating` se calcula en `MapView` y se pasa como prop. Se obtiene del hook `useBusinesses` si ya expone ratings, o se usa `null` cuando no hay dato.

**aria-label format:** `"{name}, {rating} estrellas"` o `"{name}, sin calificaciones"` cuando `averageRating` es null.

---

## S2: Focus outline visible

**CSS global** en `src/index.css` o inline styles:

```css
.marker-focus:focus-visible {
  outline: 3px solid #1976d2;
  outline-offset: 2px;
  border-radius: 50%;
}
```

Se usa `:focus-visible` (no `:focus`) para que solo se muestre al navegar con teclado, no al hacer click.

---

## S3: ARIA roles en BusinessSheet

**Componente:** `BusinessSheet.tsx`

Agregar atributos de accesibilidad al `SwipeableDrawer`:

```tsx
<SwipeableDrawer
  ...
  PaperProps={{
    sx: { ... },
    role: 'dialog',
    'aria-label': selectedBusiness ? `Detalle de ${selectedBusiness.name}` : undefined,
  }}
>
```

**Escape para cerrar:** Ya funciona por defecto en `SwipeableDrawer` de MUI (MUI maneja Escape en modals).

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/map/BusinessMarker.tsx` | Agregar wrapper div con tabIndex, role, aria-label, onKeyDown |
| `src/components/map/MapView.tsx` | Pasar `averageRating` a cada BusinessMarker |
| `src/components/business/BusinessSheet.tsx` | Agregar role="dialog" y aria-label al SwipeableDrawer |
| `src/index.css` | Agregar estilos `.marker-focus:focus-visible` |

**Archivos nuevos:** Ninguno.

---

## Tipos modificados

No se modifican tipos globales. La interfaz `Props` de `BusinessMarker` se extiende localmente con `averageRating`.

---

## Dependencias nuevas

Ninguna. Todo se resuelve con atributos HTML nativos y CSS.

---

## Fuera de scope (Fase 1)

- Navegacion con flechas entre markers cercanos (S3 del PRD, prioridad Baja).
- Atajos globales `/` o `Ctrl+K` (S3 del PRD, prioridad Baja).
- `aria-live` regions para anunciar cambios de estado.
- Orden de Tab por posicion geografica (requiere calculo de coordenadas a orden DOM, complejidad alta).

---

## Impacto en performance

- Wrapper `<div>` adicional por marker: negligible (es un elemento vacio sin layout propio).
- `onKeyDown` handler por marker: solo se ejecuta en keypress, sin impacto en render.
- `averageRating` prop: valor primitivo, no causa re-renders adicionales.
