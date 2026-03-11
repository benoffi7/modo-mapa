# Especificaciones Técnicas: Feedback, Ratings, Agregar comercio y versión

**Issue:** #11
**Fecha:** 2026-03-11

## Componentes a crear

### 1. `src/components/menu/FeedbackForm.tsx`

Formulario para enviar feedback sobre la app.

**Props:**
```typescript
interface Props {
  onDone: () => void; // vuelve a nav después de enviar
}
```

**Estado:**
- `message: string` — texto del feedback
- `category: 'bug' | 'sugerencia' | 'otro'` — categoría seleccionada
- `isSubmitting: boolean`
- `sent: boolean` — true después de enviar (muestra agradecimiento)

**Lógica:**
- `addDoc(collection(db, 'feedback'), { userId, message, category, createdAt: serverTimestamp() })`
- Después de enviar: `sent = true`, mostrar mensaje de agradecimiento 2.5s, luego `onDone()`

**Render:**
- Selector de categoría: 3 chips (Bug, Sugerencia, Otro)
- TextField multiline (4 rows, max 1000 chars) con contador
- Botón "Enviar" (disabled si mensaje vacío)
- Vista "Gracias": ícono CheckCircle + "Gracias por tu feedback"

### 2. `src/components/menu/RatingsList.tsx`

Lista de calificaciones del usuario.

**Props:**
```typescript
interface Props {
  onNavigate: () => void;
}
```

**Lógica:**
- Query: `getDocs(query(collection(db, 'ratings'), where('userId', '==', user.uid)))`
- Cruzar businessId con JSON local
- Ordenar por `updatedAt` o `createdAt` descendente

**Render por item:**
- `ListItemButton` con click → `setSelectedBusiness` + `onNavigate()`
- Primary: nombre del comercio
- Secondary: `Rating` component (readOnly) con el score + fecha
- Usar `component="span"` en secondary para evitar p anidados

**Estado vacío:** `StarBorderIcon` + "No calificaste comercios todavía"

## Componentes a modificar

### 3. `src/components/layout/SideMenu.tsx`

**Cambios:**
- Ampliar `Section`: `'nav' | 'favorites' | 'comments' | 'ratings' | 'feedback'`
- Agregar imports: `RatingsList`, `FeedbackForm`, `StarOutlineIcon`, `AddBusinessIcon`/`StorefrontOutlinedIcon`
- Habilitar Feedback (quitar disabled, agregar onClick)
- Agregar item Ratings (con `StarOutlineIcon`, color `#fbbc04`)
- Agregar item "Agregar comercio" (con `AddBusinessIcon`): `onClick` → `window.open(URL, '_blank')`
- Agregar footer con versión en la vista nav
- Actualizar título dinámico del toolbar para incluir 'Ratings' y 'Feedback'
- Agregar render de `RatingsList` y `FeedbackForm` en sección de contenido

**Footer de versión (solo en vista nav):**
```tsx
<Box sx={{ mt: 'auto' }}>
  <Divider />
  <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', py: 1.5 }}>
    Versión 1.1.0
  </Typography>
</Box>
```
La versión se lee de `package.json` via la constante de Vite: `__APP_VERSION__` (definida en `vite.config.ts`).

### 4. `vite.config.ts`

**Agregar define** para exponer la versión de package.json:
```typescript
define: {
  __APP_VERSION__: JSON.stringify(require('./package.json').version),
}
```
(O con import si es ESM)

### 5. `package.json`

**Cambiar versión:** `"version": "1.1.0"`

### 6. `firestore.rules`

**Agregar regla para `feedback`:**
```
match /feedback/{docId} {
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.message.size() > 0
    && request.resource.data.message.size() <= 1000;
}
```
Solo create — el usuario no puede leer, editar ni borrar feedback.

## Interacciones con Firebase

| Acción | Operación |
|--------|-----------|
| Enviar feedback | `addDoc(collection(db, 'feedback'), { userId, message, category, createdAt })` |
| Cargar ratings del usuario | `getDocs(query(collection(db, 'ratings'), where('userId', '==', uid)))` |

## Consideraciones de seguridad

- Feedback: solo create, sin read/update/delete por el usuario.
- Ratings: reglas existentes ya permiten read con auth.

## URL Agregar comercio

```
https://docs.google.com/forms/d/e/1FAIpQLSdCclz8fH1OQj-McD_xEsXAwP6umIcNVsudS3ZiYBXqBqoaRg/viewform
```
