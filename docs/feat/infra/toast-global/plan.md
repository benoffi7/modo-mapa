# Plan: Toast global de error/éxito

**Feature:** toast-global
**Issue:** #138
**Fecha:** 2026-03-16

---

## Fase única

### Paso 1: Crear ToastContext

**Archivo nuevo:** `src/context/ToastContext.tsx`

- Crear `ToastContext` con `createContext`.
- Implementar `ToastProvider` con estado de queue de toasts.
- Exponer hook `useToast()` con métodos `success`, `error`, `warning`, `info`.
- Renderizar `<Snackbar>` + `<Alert>` de MUI.
- Auto-dismiss configurable por severity.
- Dismiss manual con botón X.

### Paso 2: Integrar en App.tsx

- Importar `ToastProvider` de `./context/ToastContext`.
- Wrappear dentro de `<AuthProvider>`, fuera de `<NotificationsProvider>`.

### Paso 3: Integrar en BusinessComments.tsx

- Importar `useToast`.
- Agregar `toast.success()` en éxitos de submit, edit, reply.
- Agregar `toast.error()` en catches de submit, edit, reply, like.

### Paso 4: Integrar en BusinessRating.tsx

- Importar `useToast`.
- Agregar `toast.error()` en catches de rate, delete, criteria.

### Paso 5: Integrar en FavoriteButton.tsx

- Importar `useToast`.
- Agregar `toast.success()` / `toast.info()` en éxitos.
- Agregar `toast.error()` en catch.

### Paso 6: Tests

- Verificar que el toast aparece al fallar un rating (simular error de red).
- Verificar que el toast de éxito aparece al publicar comentario.
- Verificar que el toast de favoritos muestra mensaje correcto.
- Verificar auto-dismiss después del timeout.

---

## Criterios de merge

- [ ] `ToastProvider` wrappea la app correctamente
- [ ] `useToast()` disponible en toda la app
- [ ] Errores de red en ratings, comments y favorites muestran toast
- [ ] Éxitos en comments y favorites muestran toast
- [ ] Auto-dismiss funciona
- [ ] No rompe los Snackbar existentes (delete undo, share copy)
- [ ] Lint y tests pasan
