# Plan: Mapa navegable por teclado

**Specs:** [Specs](./specs.md)
**Branch:** `feat/mapa-teclado`

---

## Pasos de implementacion

### Paso 1: BusinessMarker focuseable + keyboard handler

1. En `BusinessMarker.tsx`, agregar prop `averageRating: number | null` a la interfaz `Props`
2. Crear `ariaLabel` con `useMemo`: `"{name}, {rating} estrellas"` o `"{name}, sin calificaciones"`
3. Crear `handleKeyDown` con `useCallback`: Enter/Space llama a `onClick(business.id)`
4. Envolver `<Pin>` en un `<div>` con `tabIndex={0}`, `role="button"`, `aria-label`, `onKeyDown`, `className="marker-focus"`

### Paso 2: Focus outline CSS

1. En `src/index.css`, agregar regla `.marker-focus:focus-visible` con outline azul de 3px y border-radius
2. Verificar que el outline no se muestra al hacer click (solo con Tab)

### Paso 3: Pasar averageRating desde MapView

1. En `MapView.tsx`, determinar la fuente de ratings (revisar si `useBusinesses` ya los expone o si se necesita un lookup separado)
2. Si no hay ratings disponibles en el listado, pasar `null` por ahora y dejar TODO para integracion futura
3. Agregar `averageRating` prop al render de cada `<BusinessMarker>`

### Paso 4: ARIA en BusinessSheet

1. En `BusinessSheet.tsx`, agregar `role: 'dialog'` y `aria-label` al `PaperProps` del `SwipeableDrawer`
2. Verificar que Escape cierra el drawer (ya deberia funcionar por defecto de MUI)

### Paso 5: Verificacion

1. `npx tsc --noEmit` — sin errores de tipos
2. `npm run lint` — sin warnings nuevos
3. `npm run test:run` — tests existentes pasan
4. Test manual: Tab navega entre markers, Enter/Space abre el sheet, focus outline visible

---

## Criterios de completitud

- [ ] Markers son alcanzables via Tab
- [ ] Cada marker tiene aria-label con nombre del comercio
- [ ] Enter/Space abre BusinessSheet desde marker enfocado
- [ ] Focus outline visible solo con navegacion por teclado
- [ ] BusinessSheet tiene role="dialog" y aria-label
- [ ] Escape cierra BusinessSheet
- [ ] Compilacion limpia (tsc + lint + tests)
