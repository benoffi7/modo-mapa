# PRD: Sección Comentarios en menú lateral

**Issue:** #9
**Fecha:** 2026-03-11

## Descripción

Agregar la sección Comentarios al menú lateral existente. Muestra el historial de comentarios del usuario en todos los comercios. También agrega la posibilidad de eliminar comentarios propios tanto desde el menú como desde el modal del comercio (BusinessComments).

## Contexto del proyecto

- **SideMenu** (`src/components/layout/SideMenu.tsx`): drawer lateral ya implementado con navegación. Comentarios está como placeholder disabled con "Próximamente". El tipo `Section` es `'nav' | 'favorites'`.
- **BusinessComments** (`src/components/business/BusinessComments.tsx`): muestra comentarios por comercio. Actualmente no tiene opción de eliminar.
- **Firestore `comments`**: colección con autoId, campos `userId`, `userName`, `businessId`, `text`, `createdAt`. La regla actual solo permite `read` y `create`, **no permite `delete`**.
- **MapContext**: provee `setSelectedBusiness()` para navegar al comercio.
- **businesses.json**: datos locales para resolver businessId → Business.

## Requisitos funcionales

### Sección Comentarios en menú lateral
1. Click en "Comentarios" en la navegación del drawer → muestra lista de comentarios del usuario.
2. Lista ordenada por fecha (más reciente primero).
3. Cada item muestra: nombre del comercio, texto del comentario (truncado si es largo), fecha.
4. Click en un comentario → cierra drawer, centra mapa, abre BusinessSheet del comercio.
5. Botón para eliminar comentario propio desde la lista (ícono delete con confirmación).
6. Estado vacío: "No dejaste comentarios todavía".

### Eliminar comentarios desde BusinessComments
7. En la lista de comentarios del modal del comercio, los comentarios propios del usuario muestran un ícono de eliminar.
8. Click en eliminar → confirmación → `deleteDoc` + remove del estado local.

### Firestore rules
9. Agregar regla `delete` en `comments` para que solo el dueño pueda eliminar su comentario.

## Requisitos no funcionales
- La lista se carga al abrir la sección (no al abrir el drawer).
- Cruzar `businessId` con JSON local para obtener nombre del comercio.
- Texto del comentario truncado a ~80 caracteres en la lista del menú.

## Consideraciones UX
- Consistente con el diseño de FavoritesList (misma estructura de lista).
- Ícono de eliminar solo visible en comentarios propios (en BusinessComments).
- Confirmación antes de eliminar para evitar accidentes.

## Buenas prácticas
- Reutilizar patrón de FavoritesList para la lista de comentarios.
- Agregar `delete` a Firestore rules con validación de `userId`.
- Update optimista al eliminar (remove del estado local inmediato).
