# PRD: Feedback de comercio — búsqueda y PDF

**Feature:** feedback-comercio-search
**Categoria:** content
**Fecha:** 2026-03-16
**Issue:** #149
**Prioridad:** Alta

---

## Contexto

El formulario de feedback tiene la categoría `datos_comercio` para reportar problemas con datos de un comercio. Sin embargo, cuando el admin recibe el feedback, no sabe a qué comercio se refiere el usuario salvo que lo mencione explícitamente en el texto. Además, los adjuntos solo soportan imágenes (jpg, png, webp), sin opción de adjuntar PDFs.

## Problema

- Cuando un usuario selecciona "Datos del comercio", no puede indicar fácilmente a qué comercio se refiere.
- El admin debe interpretar el texto libre para deducir el comercio, lo cual es propenso a errores.
- No se pueden adjuntar PDFs (ej: menú, comprobante, documento de corrección).
- A veces el feedback es general (no sobre un comercio específico), por lo que vincular un comercio debe ser opcional.

## Solución

### S1: Search bar de comercio en feedback

- Cuando el usuario selecciona la categoría `datos_comercio`, mostrar un campo de búsqueda opcional: "¿Sobre qué comercio? (opcional)".
- El search bar busca entre los comercios existentes (reutilizar lógica de `SearchBar`/suggestions).
- Al seleccionar un comercio, se muestra un chip con el nombre y un botón para quitar.
- El `businessId` y `businessName` se guardan en el documento de feedback en Firestore.
- Si el usuario no selecciona ningún comercio, el feedback se envía sin vínculo (es general).

### S2: Soporte de PDF en adjuntos

- Agregar `application/pdf` a los tipos de archivo permitidos en el feedback.
- Mantener el límite de 10MB existente.
- Mostrar preview del PDF como ícono + nombre de archivo (no embebido).
- En `MyFeedbackList` y `FeedbackList` (admin), mostrar link al PDF adjunto.

### S3: Visualización en admin

- En `FeedbackList` del admin, mostrar el comercio vinculado como chip clickeable.
- Click en el chip abre el BusinessSheet del comercio (o link directo).
- Filtrar feedback por comercio en el panel admin.

---

## Scope

| Item | Prioridad | Esfuerzo |
|------|-----------|----------|
| Search bar de comercio en FeedbackForm | Alta | M |
| Campos businessId/businessName en Feedback type | Alta | XS |
| Guardar vínculo en Firestore | Alta | S |
| Soporte PDF en tipos de archivo permitidos | Alta | XS |
| Preview de PDF en lista de feedback | Media | S |
| Chip de comercio en FeedbackList admin | Media | S |
| Filtro por comercio en admin | Baja | S |

**Esfuerzo total estimado:** M

---

## Cambios técnicos

### Tipos (`src/types/index.ts`)

Agregar campos opcionales a `Feedback`:
- `businessId?: string`
- `businessName?: string`

### Constantes (`src/constants/feedback.ts`)

Agregar `application/pdf` a los tipos de archivo aceptados.

### FeedbackForm (`src/components/menu/FeedbackForm.tsx`)

- Condicionar search bar a categoría `datos_comercio`.
- Reutilizar lógica de búsqueda existente.
- Chip de comercio seleccionado con opción de quitar.

### Firestore Rules

- Permitir campos `businessId` y `businessName` en creación de feedback.

### FeedbackList admin

- Mostrar comercio vinculado.
- Link/chip al comercio.

---

## Out of Scope

- Búsqueda de comercio para otras categorías (solo `datos_comercio`).
- Crear comercios nuevos desde el feedback.
- Adjuntar múltiples archivos (solo 1 como ahora).
- Preview inline de PDF (solo ícono + nombre).

---

## Success Criteria

1. Al elegir `datos_comercio`, aparece search bar opcional para vincular un comercio.
2. El comercio se puede buscar y seleccionar, o dejar vacío si es feedback general.
3. El admin ve el comercio vinculado en la lista de feedback.
4. Se pueden adjuntar PDFs además de imágenes.
5. Los PDFs se muestran como link descargable (no preview embebido).
