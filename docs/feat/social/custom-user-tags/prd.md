# PRD: Tags personalizados por usuario

**Issue:** #5
**Fecha:** 2026-03-11

## Descripción

Permitir a los usuarios crear etiquetas personalizadas para cualquier comercio. Estas etiquetas son **privadas** — solo visibles para el usuario que las creó — y se pueden editar y borrar.

## Contexto del proyecto

- La app ya tiene un sistema de **tags predefinidos** (`src/components/business/BusinessTags.tsx`) donde los usuarios votan tags como "Barato", "Delivery", etc. Estos son públicos y muestran un conteo de votos.
- Los tags predefinidos se definen en `src/types/index.ts` como `PREDEFINED_TAGS` (6 tags: barato, apto_celiacos, apto_veganos, rapido, delivery, buena_atencion).
- La data de comercios viene de `src/data/businesses.json` con tags "seed" por comercio.
- Firebase Firestore es el backend. Los tags de usuarios se guardan en la colección `userTags` con IDs compuestos (`userId__businessId__tagId`).
- La interfaz `CustomTag` ya existe en `src/types/index.ts` con campos: id, userId, businessId, label, createdAt.

## Requisitos funcionales

1. **Agregar tag personalizado**: Un chip "+" al final de la lista de tags predefinidos permite al usuario escribir un tag libre (texto corto).
2. **Visibilidad privada**: Los tags personalizados solo son visibles para el usuario que los creó. Otros usuarios no los ven.
3. **Editar tag**: El usuario puede modificar el texto de un tag personalizado que creó.
4. **Eliminar tag**: El usuario puede borrar un tag personalizado con confirmación.
5. **Persistencia**: Los tags se guardan en Firestore y persisten entre sesiones.
6. **Autenticación requerida**: Solo usuarios autenticados pueden crear/editar/borrar tags personalizados. El chip "+" solo aparece si el usuario está logueado.

## Requisitos no funcionales

- Máximo ~30 caracteres por tag para mantener el diseño compacto.
- Los tags personalizados se muestran visualmente diferenciados de los predefinidos (ej: otro color o estilo).
- La interacción debe ser fluida en mobile (input inline o dialog simple).
- Operaciones optimistas donde sea posible para UX rápida.

## Consideraciones UX

- El chip "+" se muestra al final de la fila de tags predefinidos, solo si el usuario está autenticado.
- Los tags personalizados se renderizan después de los predefinidos, con un estilo diferenciado (ej: outlined con color secundario o un ícono distinto).
- Para editar/borrar: long-press o menú contextual en el chip del tag personalizado.
- Feedback visual inmediato al crear/editar/borrar.
- No hay límite de cantidad de tags personalizados por comercio (razonable por naturaleza del uso).

## Buenas prácticas

- Usar IDs compuestos en Firestore para consultas eficientes.
- Reglas de seguridad: solo el dueño del tag puede leer/editar/borrar sus tags personalizados.
- Sanitizar input del usuario (trim, largo máximo).
- Mantener consistencia visual con el sistema de tags existente.
