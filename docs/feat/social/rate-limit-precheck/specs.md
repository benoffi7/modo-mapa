# Specs: Pre-check de rate limit en comentarios

**Feature:** rate-limit-precheck
**Issue:** #133
**Fecha:** 2026-03-16

---

## Estado actual

En `BusinessComments.tsx` (línea 100-104), ya se calcula `userCommentsToday`:

```typescript
const userCommentsToday = comments.filter((c) => {
  if (c.userId !== user?.uid) return false;
  const today = new Date();
  return c.createdAt.toDateString() === today.toDateString();
}).length;
```

Y en los handlers (líneas 134 y 223) se hace un `return` silencioso si se alcanzó el límite:

```typescript
if (userCommentsToday >= MAX_COMMENTS_PER_DAY) return;
```

**Problema:** El input se muestra igual, el usuario escribe, y al tocar enviar no pasa nada.

---

## Cambios

### 1. Reemplazar input por mensaje cuando se alcanza el límite

**Archivo:** `src/components/business/BusinessComments.tsx`

**Líneas 315-354** — El bloque `{user && (...)}` que renderiza el input:

```tsx
{user && userCommentsToday < MAX_COMMENTS_PER_DAY && (
  <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'flex-start' }}>
    {/* TextField + SendButton existentes sin cambios */}
  </Box>
)}

{user && userCommentsToday >= MAX_COMMENTS_PER_DAY && (
  <Alert severity="info" sx={{ mb: 2, borderRadius: '12px' }}>
    Alcanzaste el límite de {MAX_COMMENTS_PER_DAY} comentarios por hoy.
    Podés comentar de nuevo mañana.
  </Alert>
)}
```

### 2. Contador visual junto al input

Agregar helper text debajo del TextField que muestre el uso diario:

```tsx
helperText={
  newComment.length > 0
    ? `${newComment.length}/${MAX_COMMENT_LENGTH} · ${userCommentsToday}/${MAX_COMMENTS_PER_DAY} hoy`
    : `${userCommentsToday}/${MAX_COMMENTS_PER_DAY} comentarios hoy`
}
```

Solo mostrar el contador cuando `userCommentsToday > 0` para no agregar ruido a usuarios nuevos.

### 3. Mismo tratamiento para replies

**Líneas 406-463** — El bloque de reply inline:

- Agregar la misma condición: si `userCommentsToday >= MAX_COMMENTS_PER_DAY`, mostrar Alert en lugar del input de reply.
- Texto: "Alcanzaste el límite diario de comentarios."
- Más compacto que el principal (usar `variant="outlined"` y `sx={{ fontSize: '0.8rem' }}`).

### 4. Warning visual al acercarse al límite

Cuando quedan ≤3 comentarios (`MAX_COMMENTS_PER_DAY - userCommentsToday <= 3`):
- Cambiar color del helper text a `warning.main`.
- Texto: "Te quedan X comentarios hoy".

---

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/business/BusinessComments.tsx` | Condicionar input, agregar Alert, contador, warning |

**Nota:** Solo se modifica 1 archivo. No se necesitan nuevos archivos, servicios ni Cloud Functions.

---

## Imports necesarios

Agregar `Alert` al import de `@mui/material` (línea 2-12).

---

## Decisiones de diseño

1. **Alert en vez de ocultar** — mejor que esconder el input sin explicación, el usuario entiende por qué no puede comentar.
2. **Severity `info`** — no es un error del usuario, es un límite del sistema.
3. **Contador solo si > 0** — no mostrar "0/20 hoy" a usuarios que no comentaron, es ruido.
4. **Warning al acercarse** — feedback progresivo, el usuario sabe que le quedan pocos.
5. **No hacer query adicional** — los datos ya están disponibles en `comments` (prop del componente).
