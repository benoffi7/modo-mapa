# Especificaciones Técnicas: Sección Comentarios en menú lateral

**Issue:** #9
**Fecha:** 2026-03-11

## Componentes a crear

### 1. `src/components/menu/CommentsList.tsx`

Lista de comentarios del usuario en todos los comercios.

**Props:**

```typescript
interface Props {
  onNavigate: () => void;
}
```

**Lógica:**

- Query Firestore: `getDocs(query(collection(db, 'comments'), where('userId', '==', user.uid)))`
- Importa JSON directo para resolver businessId → Business (mismo patrón que FavoritesList)
- Ordena por `createdAt` descendente
- Estado: `comments`, `isLoading`, `confirmDeleteId` (para dialog de confirmación)

**Render por item:**

- `ListItemButton` con click → `setSelectedBusiness(business)` + `onNavigate()`
- Primary: nombre del comercio
- Secondary: texto truncado (max 80 chars) + fecha formateada
- `IconButton` con `DeleteOutlineIcon` → abre dialog de confirmación

**Eliminar:**

- `deleteDoc(doc(db, 'comments', commentId))`
- Remove optimista del estado local

**Estado vacío:**

- `ChatBubbleOutlineIcon` grande + "No dejaste comentarios todavía"

## Componentes a modificar

### 2. `src/components/layout/SideMenu.tsx`

**Cambios:**

- Ampliar tipo `Section`: `'nav' | 'favorites' | 'comments'`
- Habilitar el `ListItemButton` de Comentarios (quitar `disabled`, agregar `onClick`)
- Agregar caso `'comments'` en el render condicional (toolbar con back + CommentsList)
- Import de `CommentsList`

### 3. `src/components/business/BusinessComments.tsx`

**Cambios:**

- Agregar `IconButton` con `DeleteOutlineIcon` en cada comentario propio (`comment.userId === user?.uid`)
- Agregar estado `confirmDeleteId: string | null` para dialog de confirmación
- Agregar `handleDeleteComment(id)`: `deleteDoc` + remove del estado local
- Agregar `Dialog` de confirmación de eliminación
- Import de `deleteDoc`, `doc` de Firestore + `DeleteOutlineIcon` + `Dialog/DialogTitle/DialogContent/DialogActions/Button`

### 4. `firestore.rules`

**Cambio en regla `comments`:**

```text
match /comments/{docId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.text.size() > 0
    && request.resource.data.text.size() <= 500;
  allow delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

Solo se agrega la línea `allow delete`.

## Interacciones con Firebase

| Acción | Operación |
|--------|-----------|
| Cargar comentarios del usuario | `getDocs(query(collection(db, 'comments'), where('userId', '==', uid)))` |
| Eliminar comentario | `deleteDoc(doc(db, 'comments', commentId))` |

## Consideraciones de seguridad

- La regla `delete` valida que `resource.data.userId == request.auth.uid` (solo el dueño puede eliminar).
- No se exponen comentarios de otros usuarios en la lista del menú (filtrado por userId).
