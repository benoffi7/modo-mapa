# Plan Técnico: Sección Comentarios en menú lateral

**Issue:** #9
**Fecha:** 2026-03-11

## Pasos de implementación

### Paso 1: Actualizar `firestore.rules`
- Agregar `allow delete` en regla de `comments` con validación de userId

### Paso 2: Crear `CommentsList.tsx`
- Crear `src/components/menu/CommentsList.tsx`
- Query Firestore por userId, cruzar con JSON local
- Lista con nombre comercio, texto truncado, fecha
- Click → navegar al comercio
- Eliminar con confirmación + optimistic update
- Estado vacío

### Paso 3: Modificar `SideMenu.tsx`
- Ampliar tipo Section a incluir `'comments'`
- Habilitar ListItemButton de Comentarios
- Agregar caso 'comments' en render (toolbar back + CommentsList)

### Paso 4: Modificar `BusinessComments.tsx`
- Agregar ícono eliminar en comentarios propios
- Dialog de confirmación
- `deleteDoc` + remove del estado local

### Paso 5: Build & test local
- `npm run build`
- Test manual con emuladores

## Archivos afectados

| Archivo | Tipo |
|---------|------|
| `firestore.rules` | Modificar |
| `src/components/menu/CommentsList.tsx` | Crear |
| `src/components/layout/SideMenu.tsx` | Modificar |
| `src/components/business/BusinessComments.tsx` | Modificar |
