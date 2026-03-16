# Specs: Toast global de error/éxito

**Feature:** toast-global
**Issue:** #138
**Fecha:** 2026-03-16

---

## Arquitectura

### ToastProvider + useToast

Crear un context provider que envuelve la app y expone un hook `useToast()`.

**Archivo nuevo:** `src/context/ToastContext.tsx`

```typescript
interface Toast {
  id: string;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
  autoHideDuration?: number;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}
```

- Estado interno: array de toasts activos (máx 1 visible a la vez, queue FIFO).
- Renderiza `<Snackbar>` + `<Alert>` de MUI en la parte inferior de la pantalla.
- Auto-dismiss: 4s para success/info, 6s para error/warning.
- Dismiss manual con botón X.
- Genera `id` único con `crypto.randomUUID()`.

### Integración en App.tsx

Wrappear dentro de `<AuthProvider>` (necesita estar disponible para todos los componentes):

```
<ColorModeProvider>
  <ErrorBoundary>
    <AuthProvider>
    <ToastProvider>        ← NUEVO
    <NotificationsProvider>
      ...
    </NotificationsProvider>
    </ToastProvider>
    </AuthProvider>
  </ErrorBoundary>
</ColorModeProvider>
```

---

## Cambios por componente

### BusinessRating.tsx

**handleRate()** (línea 90-99):
- catch: agregar `toast.error('No se pudo guardar la calificación')`.

**handleDeleteRating()** (línea 101-111):
- catch: agregar `toast.error('No se pudo borrar la calificación')`.

**handleCriterionRate()** (línea 113-127):
- catch: agregar `toast.error('No se pudo guardar el criterio')`.

No agregar toast de éxito en ratings — el feedback visual ya es la estrella que cambia (UI optimista).

### BusinessComments.tsx

**handleSubmit()** (línea 132-144):
- éxito (después de `setNewComment('')`): `toast.success('Comentario publicado')`.
- catch: `toast.error('No se pudo publicar el comentario')`.

**handleSaveEdit()** (línea 156-168):
- éxito: `toast.success('Comentario editado')`.
- catch: `toast.error('No se pudo editar el comentario')`.

**handleSubmitReply()** (línea 221-234):
- éxito: `toast.success('Respuesta publicada')`.
- catch: `toast.error('No se pudo publicar la respuesta')`.

**handleToggleLike()** (línea 174-205):
- catch (ya tiene rollback): agregar `toast.error('No se pudo actualizar el like')`.

### FavoriteButton.tsx

**toggleFavorite()** (línea 19-33):
- éxito add: `toast.success('Agregado a favoritos')`.
- éxito remove: `toast.info('Removido de favoritos')`.
- catch: `toast.error('No se pudo actualizar favoritos')`.

---

## Reversión de UI optimista

El patrón actual ya revierte correctamente en:
- **BusinessRating**: `setPendingRating(null)` en catch ✓
- **BusinessComments likes**: revierte maps en catch ✓
- **FavoriteButton**: no tiene UI optimista (espera respuesta) ✓

Lo que falta es **mostrar el error al usuario**. Con el toast en el catch, queda cubierto.

---

## Archivos a crear

| Archivo | Descripción |
|---------|-------------|
| `src/context/ToastContext.tsx` | Provider + hook useToast |

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/App.tsx` | Agregar `<ToastProvider>` |
| `src/components/business/BusinessRating.tsx` | Toast de error en catch |
| `src/components/business/BusinessComments.tsx` | Toast de éxito y error |
| `src/components/business/FavoriteButton.tsx` | Toast de éxito y error |

---

## Decisiones de diseño

1. **No toast de éxito en ratings** — la estrella coloreada ya es feedback suficiente.
2. **Sí toast de éxito en comments y favorites** — la acción no tiene feedback visual obvio.
3. **Un toast a la vez** — evita stack de toasts. El siguiente espera a que el actual se cierre.
4. **No "Deshacer" en toasts** — el undo-delete de comments ya usa su propio Snackbar y funciona bien.
5. **Posición**: bottom-center, consistente con los Snackbar existentes.

---

## Para el review

1. ¿Te parece bien no mostrar toast de éxito en ratings (solo error)?
2. ¿4s/6s de auto-dismiss está bien o preferís otro timing?
3. ¿Querés que el toast de favoritos diga "Agregado a favoritos" o solo "Guardado"?
