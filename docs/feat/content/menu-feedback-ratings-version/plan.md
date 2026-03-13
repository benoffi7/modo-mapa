# Plan Técnico: Feedback, Ratings, Agregar comercio y versión

**Issue:** #11
**Fecha:** 2026-03-11

## Pasos de implementación

### Paso 1: `package.json` y `vite.config.ts`

- Actualizar versión a `1.1.0` en package.json
- Agregar `define: { __APP_VERSION__: JSON.stringify(version) }` en vite.config.ts

### Paso 2: `firestore.rules`

- Agregar regla para colección `feedback` (solo create)

### Paso 3: Crear `RatingsList.tsx`

- Query ratings por userId, cruzar con JSON, lista con estrellas

### Paso 4: Crear `FeedbackForm.tsx`

- Formulario con categoría (chips) + textarea + enviar → Firestore + agradecimiento

### Paso 5: Modificar `SideMenu.tsx`

- Ampliar Section type
- Agregar items: Ratings, Feedback (habilitado), Agregar comercio (link externo)
- Footer con versión
- Render de RatingsList y FeedbackForm

### Paso 6: Build & test

## Archivos afectados

| Archivo | Tipo |
|---------|------|
| `package.json` | Modificar (versión) |
| `vite.config.ts` | Modificar (define version) |
| `firestore.rules` | Modificar (regla feedback) |
| `src/components/menu/RatingsList.tsx` | Crear |
| `src/components/menu/FeedbackForm.tsx` | Crear |
| `src/components/layout/SideMenu.tsx` | Modificar |
